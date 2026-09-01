# Phase 31: Procedure Re-pointing - Research

**Researched:** 2026-08-31
**Domain:** Record correction and verification scoring — provenance/attribution records, a dated upstream snapshot manifest, and requirement-status bookkeeping. **No runtime code and no new dependencies.**
**Confidence:** HIGH (every claim below is measured against this tree today; nothing rests on training knowledge)

## Summary

This is **not an implementation phase**. The work the phase title names — re-pointing the
absorbed procedures — landed in Phase 29 plan 29-09, and `REPOINT-01`/`REPOINT-02` are
already recorded `Complete` against Phase 29. What is left is two things: **scoring an
already-true property with evidence** (criterion 1), and **correcting a record that has
silently gone stale** (criterion 2).

Criterion 1 is **already true on disk and passing every instrument that exists.** The
`ABS-02` chain measures exactly 10 attribution blocks across `src/skills/` and
`installer/skills/`, each carrying the same two naming lines (`grep -x` gives 10 and 10),
the three absorbed playbooks are **byte-identical between the two trees**, and
`routine-queue-walker/SKILL.md:3`'s `description:` was already rewritten substantively —
it names *"an existing C64 annotation store's backlog"* and no longer names the retired
analyser at all. `ABS-03`'s instrument passes with the maximum observed pairwise score at
**0.250** against a **0.35** threshold and an **empty** allowlist. So criterion 1's remaining
work is a **verification pass that produces the measurement**, plus (recommended) **one new
assertion** that scores the specific claim "its two naming lines byte-identical" directly
rather than by proxy — no instrument currently asserts that exact sentence.

Criterion 2 is **genuinely stale and nothing in this repository can see it.**
`upstream-procedure-manifest.json` carries **seven live references to modules, symbols and
test files that Phase 29 deleted or renamed** — four to `anno-tools.ts`, one to
`CURATED_ANNO_TOOLS`, one to `anno-session.ts`, one to `anno-derivation.test.ts` —
including inside its **third re-sync trigger's own mechanism**, the instruction criterion 2
turns on. The manifest lives under `.planning/`, which the removal gate excludes by prefix
and which `docs-dangling-refs.test.ts` deliberately does not scan, so the drift is invisible
to CI. `anno_undo`'s `omit` entry has **no `requirement_id` at all**, and the criterion
v0.7.0 supplies for it (`STORE-04` + decision `D2`) points **toward keeping the omission**,
not reversing it — the trap the criterion's own wording warns about.

**Primary recommendation:** Plan this as **two plans, not one**. Plan A: re-point the
manifest's stale prose and add `anno_undo`'s `requirement_id`, in one commit, with the
direction of the decision stated explicitly and `anno-derivation.test.ts` re-run. Plan B:
the verification/scoring pass — measure the `ABS-02` chain, add the naming-line assertion,
score `ABS-03`, and move `REPOINT-03`/`REPOINT-04` to `Complete` in `REQUIREMENTS.md`, the
`ROADMAP.md` progress table and `STATE.md`. **Plan B needs `USE_WORKTREES_FOR_PLAN=false`**
because it delivers `ROADMAP.md` and `STATE.md` content.

## User Constraints

**There is no `CONTEXT.md` for this phase** — `/gsd-plan-phase` is running without
`/gsd-discuss-phase`. Verified: `gsd-tools query init.phase-op 31` returns
`"has_context": false`, and `.planning/phases/31-procedure-re-pointing/` is empty
[VERIFIED: `ls -la .planning/phases/31-procedure-re-pointing/` → only `.` and `..`].

Per the invocation, **the ROADMAP section's Notes are the locked constraints.** They are
reproduced here verbatim-in-substance as the planner's decision floor:

### Locked Decisions (from ROADMAP Phase 31 Notes — treat as CONTEXT.md `## Decisions`)

1. **Ordering constraint 3 is NOT this phase's.** It became an intra-phase constraint of
   Phase 29 and is restated there and in Sequencing Rationale. Do not re-derive it, do not
   re-enforce it, do not delete it.
2. **The re-pointing itself is DONE and must NOT be redone.** All five absorbed procedures,
   the 10 files under `src/skills/`, the 18 distinct tool names, `scripts/packer-finding.mjs`,
   `templates/memory-map.template.md` and the gitignored-but-shipped `installer/skills/`
   twin were re-pointed in Phase 29 plan 29-09 and proven against the **shipped** copy by
   `scripts/check-npm-packages.mjs`. `REPOINT-01` and `REPOINT-02` are complete against
   Phase 29.
3. **`routine-queue-walker/SKILL.md:3`'s `description:` is ALREADY substantively rewritten.**
   What remains is **confirming the `ABS-02` chain, not rewriting the description.**
   `REPOINT-03` is not recorded complete only because no verification pass has scored the
   chain's byte-identity across both trees.
4. **`packer-finding.mjs`'s recorded provenance fate is CLOSED.** Do not re-open it. Its
   residual mention sits under the removal gate's `surviving-provenance` permanent exemption.
5. **`grep -rail 'the external analyser' installer/skills` → 0 is UNSATISFIABLE BY DESIGN.** The
   `ABS-02` headers are protected in both directions and both trees. Deleting a header
   **fails** the gate rather than silencing it. Never attempt to drive that grep to zero.
6. **`ANNO-14`/`ANNO-15`'s symbol round trip is WITHDRAWN and not this phase's work.**
   No phase currently owns its return.

### Claude's Discretion

- How the "two naming lines byte-identical" claim is *scored*: a new assertion in
  `skill-attribution.test.ts`, a new standalone check, or a recorded manual measurement.
  (Recommendation below: extend `skill-attribution.test.ts` — it already owns the chain.)
- Whether the manifest's *other* stale citations (`SURF-01`, `SURF-03`, `Phase 20/21`,
  and `toggle_splitter`'s blocker that `STORE-02` closed) are corrected in the same plan or
  left as dated history. (Recommendation below: correct the *live instructions*, date the
  *past-tense facts*.)
- Whether `scripts/check-no-analyser.mjs`'s two "ROADMAP Phase 31 criterion 4"
  citations are corrected in this phase.

### Deferred Ideas (OUT OF SCOPE)

- The symbol round trip's return (`export-lbl`/`import-lbl`).
- Any per-edit inverse-command undo journal — permanently out of scope per `D2`.
- Any re-litigation of `packer-finding.mjs`'s provenance value.
- Any widening or narrowing of the removal gate's exemption set beyond a stale-citation fix.

## Phase Requirements

| ID | Description (verbatim from `.planning/REQUIREMENTS.md`) | Research Support |
|----|-------------|------------------|
| REPOINT-03 | *"The `ABS-02` attribution chain survives the code's deletion, because the prose remains adapted from the external analyser — 5 blocks in 3 files under `src/skills/` plus their 5 synced twins, 10 instances across two trees, each carrying two naming lines. Separately, `routine-queue-walker/SKILL.md:3`'s YAML `description:` names the external analyser and must change **substantively** rather than be exempted, which re-triggers `ABS-03`'s pairwise trigger-collision check across all seven skill descriptions"* [VERIFIED: .planning/REQUIREMENTS.md:120] | §1 (the chain as measured), §2 (the description, already rewritten), §3 (ABS-03's instrument and its verdict), §8 (what is left) |
| REPOINT-04 | *"`upstream-procedure-manifest.json` is updated in the same commit that changes what it describes — its own third re-sync trigger requires it, and `anno_undo`'s `omit` disposition is one v0.7.0 supplies a criterion for"* [VERIFIED: .planning/REQUIREMENTS.md:121] | §4 (the manifest and its drift), §5 (`anno_undo`'s direction), §6 (the same-commit question), §8 |

Both rows currently read `Pending` against `Phase 31`
[VERIFIED: .planning/REQUIREMENTS.md:241-242 — `| REPOINT-03 | Phase 31 | Pending |` and
`| REPOINT-04 | Phase 31 | Pending |`].

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| The `ABS-02` attribution chain (per-file headers) | Shipped skill prose (`src/skills/**/SKILL.md`) | Synced twin (`installer/skills/**`) | The attribution must travel *inside* each file, because a consumer may copy one playbook out of the tarball. The twin is generated by `installer/scripts/sync-skills.mjs`, so it is a derived tier, never hand-edited |
| Enforcing the chain (presence, six fields, digest equality) | Test tier (`src/mcp/vice/skill-attribution.test.ts`) | — | A named registry, not a corpus scan — a file with no absorbed content owes no header |
| Protecting the chain from deletion | CI-gate tier (`scripts/check-no-analyser.mjs`) | — | Bidirectional block+hit pins in **both** trees; deleting a header trips the gate |
| `ABS-03` trigger uniqueness | CI-gate tier (`scripts/check-skill-description-overlap.mjs`) | Test tier (`skill-description-overlap.test.ts` over the shared predicate module) | The runner runs at import time; the predicates live in `scripts/lib/skill-descriptions.mjs` so the test can drive them |
| The upstream snapshot record | Planning-artifact tier (`.planning/phases/19-…/upstream-procedure-manifest.json`) | — | Deliberately under `.planning/` and therefore **outside** the removal gate's scope and outside `docs-dangling-refs.test.ts`'s scan set |
| Manifest ↔ surface agreement | Test tier (`src/mcp/vice/anno-derivation.test.ts`) | — | The only mechanical link between the planning artifact and the live surface, in both directions |
| Requirement/phase status | Planning-record tier (`REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`) | — | `ROADMAP.md`/`STATE.md` are worktree-forbidden; `REQUIREMENTS.md` is not |

## Project Constraints (from CLAUDE.md)

Directives from `./CLAUDE.md` that bear on this phase:

- **GSD workflow enforcement.** No direct repo edits outside a GSD workflow. All edits go
  through `/gsd-execute-phase`.
- **Worktree isolation is ON (`workflow.use_worktrees: true`)** [VERIFIED:
  .planning/config.json `"use_worktrees": true`]. But: *"A plan delivering `.planning/STATE.md`
  or `ROADMAP.md` content gets the stock per-plan carve-out `USE_WORKTREES_FOR_PLAN=false`
  (worktree executors may not touch those files … the commit strips them). `REQUIREMENTS.md`
  is unaffected."* **This phase's record-correction plan delivers both** → it needs the
  carve-out.
- **`cleanup-wave` refuses any branch whose diff contains a deletion, unconditionally.** If
  a plan's diff removes lines-as-files (it should not here — every edit is an in-place
  correction), merge by hand.
- **GSD is a vendored, gitignored install with zero local customisations.** Never edit
  anything under the vendored tree. `.claude/gsd-local-patches/` must stay empty.
- **Node ≥ 22.18, no build step for the shipped server.** Irrelevant here — no shipped
  module changes — except that if `skill-attribution.test.ts` gains an assertion, `tsc
  --noEmit` must stay green.
- **Any host-facing path must go through `hostpath.ts`/`containerpath.ts`.** Note the
  *inverse* constraint that applies here: `skill-attribution.test.ts`'s own header forbids
  importing either — *"Do not import `hostpath.ts` or `containerpath.ts`. Every path here is
  repo-side"* [VERIFIED: src/mcp/vice/skill-attribution.test.ts:70-72]. Same prohibition in
  `anno-derivation.test.ts:45-47`. A new assertion must use `repoRoot({ from: HERE })`.
- **Never `import()`, `require()`, `eval()` or spawn anything under `src/skills/`** —
  *"Skill content is untrusted first-party prose: it is read as a string and matched, never
  executed"* [VERIFIED: src/mcp/vice/skill-attribution.test.ts:73-75].
- **CLAUDE.md's own project-skills table is a byte-identical copy of every SKILL.md
  `description:`** and is asserted as such. If a description ever changes, CLAUDE.md must
  change in the same commit. (Not required this phase — the description is already final.)

## Standard Stack

No new dependencies. Everything this phase needs already exists in the repository.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Node built-in test runner (`node --test`) | Node ≥ 22.18 | Every assertion in this phase | The repo has no separate test framework [VERIFIED: src/mcp/vice/package.json:112 `"test": "node --test '*.test.*'"`] |
| `src/mcp/vice/test-gate.mjs` | in-repo | The local test entry point | `npm run test:automated` → `node test-gate.mjs` [VERIFIED: src/mcp/vice/package.json:113] |
| TypeScript (typecheck only) | 7.0.2 | `tsc --noEmit -p tsconfig.json` | [VERIFIED: src/mcp/vice/package.json:115] |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `scripts/check-no-analyser.mjs` | The removal gate; bidirectional `ABS-02` header protection | Every commit of this phase |
| `scripts/check-skill-description-overlap.mjs` | `ABS-03`'s instrument | Criterion 1's scoring |
| `scripts/check-npm-packages.mjs` | Proves the **shipped** twin tree matches | Any claim about `installer/skills/` |
| `installer/scripts/sync-skills.mjs` | Regenerates the twin tree | Runs automatically via `prepack` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `skill-attribution.test.ts` with the naming-line assertion | A new standalone `scripts/check-abs02-naming-lines.mjs` | A new script needs a CI wiring step and a second corpus walk. `skill-attribution.test.ts` already owns the chain, already has the registry, and already walks both the registry and the corpus. **Prefer extending it.** But note it scans `src/skills` only (`SKILLS_DIR = join(ROOT, "src/skills")` [VERIFIED: src/mcp/vice/skill-attribution.test.ts:88]), so a both-trees assertion must add the second root explicitly |
| A `grep -x` count recorded in the SUMMARY | A committed assertion | A recorded grep is evidence for one commit; an assertion is evidence forever. The project's own doctrine (`skill-consumer-paths.test.ts`, quoted throughout) is registry-and-assertion, not measurement-in-prose |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Every tool named above is
either a Node built-in or a first-party file already committed to this repository.
Package-legitimacy verification was therefore not run, and no `[SLOP]`/`[SUS]` verdicts
exist to report.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

## Finding 1 — The `ABS-02` attribution chain as it exists on disk right now

### Where the 10 instances are

**Confirmed: exactly 10 blocks, across two trees, 5 per tree, in 3 files per tree.**

| Tree | File | Blocks |
|------|------|--------|
| `src/skills/` | `c64-memory-mapping/SKILL.md` | 2 |
| `src/skills/` | `c64-program-recon/SKILL.md` | 2 |
| `src/skills/` | `routine-queue-walker/SKILL.md` | 1 |
| `installer/skills/` | `c64-memory-mapping/SKILL.md` | 2 |
| `installer/skills/` | `c64-program-recon/SKILL.md` | 2 |
| `installer/skills/` | `routine-queue-walker/SKILL.md` | 1 |
| | **Total** | **10** |

[VERIFIED: `grep -ro "ATTRIBUTION (ABS-02)" src/skills installer/skills | wc -l` → `10`;
per-file counts from `grep -rc` as tabulated]

**The two trees are `src/skills/` and `installer/skills/`** — confirmed independently by the
removal gate's own pin table, which names all six paths:

```js
// VERBATIM from scripts/check-no-analyser.mjs:353-360
const SKILL_ATTRIBUTION_PINS = {
  "src/skills/c64-memory-mapping/SKILL.md": { blocks: 2, hits: 5 },
  "src/skills/c64-program-recon/SKILL.md": { blocks: 2, hits: 4 },
  "src/skills/routine-queue-walker/SKILL.md": { blocks: 1, hits: 3 },
  "installer/skills/c64-memory-mapping/SKILL.md": { blocks: 2, hits: 5 },
  "installer/skills/c64-program-recon/SKILL.md": { blocks: 2, hits: 4 },
  "installer/skills/routine-queue-walker/SKILL.md": { blocks: 1, hits: 3 },
};
```
[VERIFIED: scripts/check-no-analyser.mjs:353-360]

Note `2+2+1 = 5` per tree and `5+4+3 = 12` hits per tree, `24` across both — which is exactly
what the gate reports for the class (`skill-attribution-headers 24`).

### What "its two naming lines" are

The two lines in each block that **name the external analyser**:

```
Adapted from the external analyser.
  Source repository: an upstream repository
```

Measured across **both** trees:

- `grep -rx "Adapted from the external analyser." src/skills installer/skills | wc -l` → **10**
- `grep -rx "  Source repository: an upstream repository" src/skills installer/skills | wc -l` → **10**

[VERIFIED: both commands run 2026-08-31; both returned `10`]

So all 20 naming lines are **byte-identical**, 10 of each string. **One block orders them
differently** — `src/skills/c64-program-recon/SKILL.md` has `Adapted from…` at `:571` and
`Source repository:` at `:577`, with `Source path:` in between
[VERIFIED: `grep -n` and `sed -n '565,585p'`]. The **lines** are byte-identical; their
**order within one block** differs. Criterion 1 says "each with its two naming lines
byte-identical", which the measurement satisfies — but a plan must not write an assertion
that also pins *adjacency* or it will go red on a correct tree.

### Byte-identity between the two trees

`diff -q` on all three absorbed playbooks: **IDENTICAL** for all three. `diff -rq src/skills
installer/skills` reports only six deliberately-excluded test/fixture entries (`*.test.mjs`,
`test-corpus.mjs`) and no content differences [VERIFIED: `diff -rq` output].

The twin is **generated**: running any consumer of `packFiles()` (including the removal gate)
triggers `npm pack --dry-run` → `prepack` → `sync-skills.mjs`, which reports
`sync-skills: copied 7 skill(s) … excluded 6 non-shipping entries`
[VERIFIED: observed in the removal-gate run]. `installer/skills` is gitignored, so this
regeneration never dirties the git tree.

### What `skill-attribution.test.ts` asserts — exactly

Seven tests, **all scoped to `src/skills` only**. It does *not* look at `installer/skills`.

1. **Registry ↔ manifest relation.** `ABSORBED_FILES.length >= 1`; `REQUIRED_HEADER_FIELDS.length === 6`; `ABSORBED_FILES.length === manifest.procedures.length`; and the **upstream-path SET** deep-equals the manifest's procedure path set. Then per row: destination exists, manifest entry resolves, and **exactly one** attribution block names that row's upstream source [VERIFIED: skill-attribution.test.ts:419-459].
2. **All six provenance fields present with non-empty values** — the six being literally:
   ```js
   // VERBATIM from src/mcp/vice/skill-attribution.test.ts:174-181
   const REQUIRED_HEADER_FIELDS: readonly string[] = [
     "Source repository:",
     "Source path:",
     "Pinned commit:",
     "Source sha256:",
     "Upstream licence:",
     "This project elects:",
   ];
   ```
3. **Commit and digest equality against the manifest, as lowercase hex** — every 40-hex token in the block must `assert.equal` the manifest's `commit`; every 64-hex token must equal that row's `entry.sha256`. Plus `block.includes(manifest.repository)`, `manifest.licence`, `manifest.elected_licence` [VERIFIED: skill-attribution.test.ts:475-507].
4. **The adaptation statement** `"ADAPTED, NOT VERBATIM."` present, **and** more than 80 characters of named deviations after it [VERIFIED: skill-attribution.test.ts:509-525, constant at :187].
5. **The deferred-BASIC trigger vocabulary reaches no `description:`** over the whole `src/skills` corpus (floor: ≥ 6 SKILL.md files).
6. **The absence half:** no file under `src/skills/` names a path inside the upstream excluded agent-skills directory (corpus floor ≥ 20 files), proven to bite on an in-memory plant.
7. **The notices guard** (plan 19-07): the three `THIRD-PARTY-NOTICES.md` files reproduce the upstream MIT notice **byte-exactly** — sha256 `e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b`, 1072 bytes [VERIFIED: skill-attribution.test.ts:317, :322] — plus a forbidden-claim absence check.

**What it does NOT assert:** the count `10`; anything about `installer/skills`; anything about
the *two naming lines* as such. Byte-identity across trees is currently scored only by
proxy — the removal gate's per-file hit/block pins in both trees, plus `diff -r`.
**This is the gap criterion 1's scoring should close.**

### Is the chain currently intact?

**YES.** `node --test skill-attribution.test.ts skill-description-overlap.test.ts
anno-derivation.test.ts` → **53 tests, 52 pass, 0 fail, 1 skipped** (the skip is
`anno-derivation.test.ts`'s live-gated upstream re-hash, which SKIPs when
`ANNO_UPSTREAM_CLONE` is unset — by design). The removal gate exits **0** with
`skill-attribution-headers 24` on its exact pins [VERIFIED: both runs, 2026-08-31].

## Finding 2 — `routine-queue-walker/SKILL.md:3`'s `description:`

**Current text, verbatim** [VERIFIED: src/skills/routine-queue-walker/SKILL.md:3]:

> `description: Drive an existing C64 annotation store's backlog of undocumented routines and auto-named symbols to closure — build the candidate queue from labels and comments, work it one entry at a time against explicit addresses, rebuild it after every pass, and report every leftover. Use when asked to annotate every remaining routine in a project, document all undocumented subroutines left in an annotation project, rename the leftover auto-generated labels, clear a backlog of unnamed symbols, drive an annotation pass to completion, or list what is still unannotated after a pass.`

**It is already substantively rewritten.** It names *"an existing C64 annotation store"* and
carries **zero** mentions of the retired analyser. The file's only three `the external analyser`
mentions are at `:8`, `:9` (the two naming lines) and `:35` (*"installed the external analyser from
the crate"*, inside the attribution block's deviation list)
[VERIFIED: `grep -n "the external analyser" src/skills/routine-queue-walker/SKILL.md` → lines 8, 9, 35].

**So this phase only has to confirm and score it.** Do not rewrite it. The ROADMAP Notes say
so, and 29-09-SUMMARY.md records the rewrite plus the CLAUDE.md row that had to move in the
same commit.

### The pairwise collision metric and its threshold

- **Metric:** max-pairwise-clause **Jaccard**, over normalised trigger clauses.
  `DESCRIPTION_OVERLAP_THRESHOLD = 0.35`, described in its own comment as
  *"MEASURED, NOT CHOSEN"* against 55 pairs in `19-RESEARCH.md` §4.3
  [VERIFIED: scripts/lib/skill-descriptions.mjs:64-65, :97].
- **Inclusive comparison:** `pairScores(map).filter((p) => p.identical || p.score >= threshold)`
  [VERIFIED: scripts/lib/skill-descriptions.mjs:434-436] — a pair scoring *exactly* 0.35 is
  reported, and identical normalised clauses collide **regardless of the threshold**.
- **Allowlist:** `export const COLLISION_ALLOWLIST = [];` — **empty**
  [VERIFIED: scripts/lib/skill-descriptions.mjs:118]. A stale entry is itself a failure.
- **Corpus floor:** `MIN_SKILLS_SCANNED = 6` — a floor, never an equality, and its comment
  names the exact past defect an equality caused
  [VERIFIED: scripts/check-skill-description-overlap.mjs:79].

### Does it pass right now? — YES

```
check-skill-description-overlap: OK -- 7 skills scanned (acme-build, c64-memory-mapping,
c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker,
vice-wedge-triage); 21 pairs compared (n*(n-1)/2 for n=7); observed maximum score 0.250
from c64-program-recon :: c64-provenance-diff; threshold 0.35 (inclusive); allowlist size 0;
CLAUDE.md project-skills table: 7 rows, all byte-identical to their SKILL.md.
```
[VERIFIED: `node scripts/check-skill-description-overlap.mjs`, exit 0, 2026-08-31]

**This output line is the evidence criterion 1's `ABS-03` clause needs.** Note the last
clause: the gate also proves CLAUDE.md's table is byte-identical — a seventh failure mode
(#7 in its header) that couples any description change to CLAUDE.md.

## Finding 3 — `ABS-03`'s instrument and the seven skills

**The seven skills** (the corpus the gate scanned, in its own report order)
[VERIFIED: gate output above, cross-checked against `src/skills/*/SKILL.md` frontmatter]:

1. `acme-build`
2. `c64-memory-mapping`
3. `c64-program-recon`
4. `c64-provenance-diff`
5. `c64-ram-capture`
6. `routine-queue-walker`
7. `vice-wedge-triage`

**`ABS-03`'s instrument is a pair, sharing one predicate module** — this is the pattern, and a
plan must not treat either half as the whole:

| Half | Path | Role |
|------|------|------|
| The CI runner | `scripts/check-skill-description-overlap.mjs` | *"This is the top-level CI runner."* Wired into CI as *"Validate skill description trigger uniqueness (Phase 19, ABS-03)"* [VERIFIED: .github/workflows/ci.yml:204-205] |
| The predicates | `scripts/lib/skill-descriptions.mjs` | *"Every PREDICATE it checks with lives in `./lib/skill-descriptions.mjs`, and `src/mcp/vice/skill-description-overlap.test.ts` imports that SAME module"* [VERIFIED: check-skill-description-overlap.mjs header] |
| The test | `src/mcp/vice/skill-description-overlap.test.ts` | Drives those predicates over planted violations, negative controls, threshold-boundary and ordering-stability cases. Its last test is a **live-execution control**: *"live-execution control: check-skill-description-overlap.mjs exits 0 with its OK line"* [VERIFIED: test output, subtest `ok 53`] |
| The corpus walk | `scripts/lib/skill-corpus.mjs` | One walker, shared. The runner *"derives no second walker (the WR-12 lesson)"* |

**Current verdict: PASS**, both halves. Exit 0 from the runner; 0 failures from the test.

## Finding 4 — `upstream-procedure-manifest.json`

### Exact path

```
.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json
```
[VERIFIED: `find . -name 'upstream-procedure-manifest.json'` → that one path only; and both
consuming tests resolve it identically — `resolve(HERE, "../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json")`
at skill-attribution.test.ts:89-92 **and** anno-derivation.test.ts:68-71]

**One file, two independent readers, both by relative resolve.** Moving or renaming it breaks
both. Do not move it.

### Schema / shape

Top-level keys, all read by at least one test:

| Key | Type | Asserted by |
|-----|------|-------------|
| `repository` | string | `anno-derivation.test.ts:104` (exact equality to `"an upstream repository"`); `skill-attribution.test.ts:497-500` (header must contain it) |
| `commit` | 40 lowercase hex | `assert.match(manifest.commit, /^[0-9a-f]{40}$/)` — abbreviation is explicitly forbidden |
| `commit_date`, `upstream_version` | string | `upstream_version` pinned `assert.equal(manifest.upstream_version, "0.9.20")` |
| `licence` | string | `assert.equal(manifest.licence, "MIT OR Apache-2.0")` |
| `licence_copyright` | string | `assert.match(…, /the upstream author/)` |
| `elected_licence` | string | must be in `["MIT", "Apache-2.0"]` |
| `resync_trigger` | string (legacy, singular) | *"the original resync_trigger string must be preserved"* — must stay non-empty |
| `resync_triggers` | array of `{trigger, mechanism}` | array, `length >= 2`, every entry's `trigger` and `mechanism` non-empty |
| `disposition_rationale` | object keyed by upstream verb name → `{disposition, justification, upstream_citation, sites, requirement_id?, also_required_by?}` | see below |
| `procedures` | array of 5 `{path, sha256, bytes, destination, tools}` | `length === 5` exactly; `path` matches `/^\.agent\/skills\/anno-analyze-/`; `sha256` 64-hex; `bytes` positive integer; `destination` must not include `.agent/skills`; every value in `tools` must be a known disposition |

`KNOWN_DISPOSITIONS` is the only union in play:
```ts
// VERBATIM from src/mcp/vice/anno-derivation.test.ts:77
const KNOWN_DISPOSITIONS: readonly string[] = ["curated", "omit", "adapt-to-address-input"];
```
**A fourth value fails outright** — both in the schema test (`:115`) and in
`derivationVerdict()`'s `else` branch (`:381-389`), which is *"NEVER SKIPPED"*.

### The re-sync triggers — enumerated

**Trigger 1** — `"The installed the external analyser is upgraded past 0.9.20."`
Mechanism reads the new crate's `.cargo_vcs_info.json`, re-fetches the five paths, sha256s
each, diffs against the manifest. Its last sentence names the performer:
*"**anno-derivation.test.ts**'s live-gated re-hash check performs the comparison half
when ANNO_UPSTREAM_CLONE points at a clone of the pinned tree."*
[VERIFIED: manifest:13] — **`anno-derivation.test.ts` does not exist** (renamed to
`anno-derivation.test.ts` by plan 29-05). **STALE.**

**Trigger 2** — `"anno_get_binary_info's response field set changes."`
Mechanism cites `SURF-03`'s packer finding and `19-RESEARCH.md` §2.2(a) [VERIFIED: manifest:17].
`SURF-03` is not in the current `REQUIREMENTS.md` [VERIFIED: `grep -n "SURF-01\|SURF-03"
.planning/REQUIREMENTS.md` → no matches]. Historical citation; lower priority.

**Trigger 3 — the one criterion 2 turns on. VERBATIM:**

> `"trigger": "A future phase needs an upstream call this manifest currently disposes of as omitted."`
>
> `"mechanism": "Every non-curated call has a disposition_rationale entry below carrying the reason it was left out. Two of them (anno_toggle_splitter, anno_set_immediate_format) already name the requirement that would supply their criterion. Adding one to CURATED_ANNO_TOOLS requires updating that entry's disposition in the same commit, so the manifest cannot silently disagree with anno-tools.ts."`

[VERIFIED: .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json:20-21]

**Both of its named anchors are gone.** `CURATED_ANNO_TOOLS` and `anno-tools.ts` do not
exist [VERIFIED: `[ -f src/mcp/vice/anno-tools.ts ]` → GONE]. The surviving equivalents are
`CURATED_ANNO_TOOLS` and `anno-tools.ts`
[VERIFIED: src/mcp/vice/anno-tools.ts:944 —
`export const CURATED_ANNO_TOOLS: readonly string[] = ANNO_TOOL_DEFINITIONS.map((def) => def.name);`].
**This is the single most important edit in the phase:** the instruction criterion 2 invokes
currently points a future reader at a module that was deleted.

### Which test enforces the manifest

Two, with different jobs — a plan must run **both**:

| Test | What it enforces |
|------|------------------|
| `src/mcp/vice/anno-derivation.test.ts` | The manifest **as a snapshot record** (pin shape, dispositions, justifications+citations, triggers+mechanisms, licence) **and** the manifest ↔ live-surface agreement in **both** directions |
| `src/mcp/vice/skill-attribution.test.ts` | The manifest ↔ **attribution header** agreement: procedure count, path set, per-row commit and digest, repository/licence strings |

### Is it in sync? — NO. Seven stale live references.

| Manifest line | Stale reference | Reality |
|---|---|---|
| `:13` | `anno-derivation.test.ts` | Renamed → `anno-derivation.test.ts` (29-05) |
| `:17` | `SURF-03` | Not a current requirement id |
| `:21` | `CURATED_ANNO_TOOLS` | Deleted → `CURATED_ANNO_TOOLS` |
| `:21` | `anno-tools.ts` | Deleted → `anno-tools.ts` |
| `:27` | `anno-tools.ts`, `SURF-01` | Deleted / not current |
| `:33` | `anno-tools.ts` | Deleted |
| `:39` | `SURF-01`, `Phase 20`, `Phase 20/21`, and a blocker `STORE-02` **closed by construction** | See below |
| `:47` | `anno-tools.ts`, `anno-session.ts`, `Phase 21` | `anno-session.ts` deleted; no FIFO-mutex module of that name exists |
| `:54` | `SURF-03` | Not current |

[VERIFIED: `grep -n` for each token against the manifest, results as tabulated; existence of
each named file checked with `[ -f … ]`]

**Two extra facts a plan should know before touching `:39`:**
`STORE-02` in the current requirements reads: *"Ranges are stored as ranges and are **never
merged on adjacency**, so no splitter concept is needed and none is introduced — the
manifest's named blocker for `DECOMP-01` and `BUILD-02`, and the over-merge bias it predicts
for `COV-01`, are designed out by construction rather than worked around"*
[VERIFIED: .planning/REQUIREMENTS.md:83]. So `anno_toggle_splitter`'s justification names a
blocker that this milestone **closed**. And `DECOMP-01..04`/`BUILD-01..06` were *"Re-mapped
from v0.7.0 to v0.9.0 on 2026-08-26"* [VERIFIED: .planning/REQUIREMENTS.md:180-181] — so the
`requirement_id`s in those entries are still **live** requirement ids, just in a later
milestone. **Do not delete them.** The `Phase 20/21` and `Phase 21` phase numbers, however,
are from a superseded roadmap.

**Nothing in this repository can see any of this.** The removal gate's scope is
*"( git ls-files , minus the `".planning/"` PREFIX ) UNION packFiles("installer").files"*
[VERIFIED: scripts/check-no-analyser.mjs:12-14], and `docs-dangling-refs.test.ts`
deliberately excludes `.planning/phases/**` — *"Executed-phase artifacts under
`.planning/phases/**` are historical records that legitimately quote the wrong wording while
describing its removal … so neither is scanned"* [VERIFIED: docs-dangling-refs.test.ts:19-24].
That exclusion is correct and must not be widened; it is *why* this drift needs a phase.

## Finding 5 — `anno_undo`'s `omit` disposition

### Where the disposition is recorded — two places, both must agree

1. **In the procedure's `tools` map:** `an upstream blocks procedure`'s entry
   carries `"anno_undo":"omit"` [VERIFIED: manifest:61].
2. **In `disposition_rationale`,** as its own entry [VERIFIED: manifest:31-36]:

```json
"anno_undo": {
  "disposition": "omit",
  "justification": "anno_set_data_type is idempotent over a range, so upstream's 'if a conversion was wrong, undo it and redo it correctly' collapses to 'set it correctly'. anno-tools.ts records undo/redo as earning no place under this surface's own discipline even now that a session persists. Omitting it costs nothing and adds no surface.",
  "upstream_citation": "an upstream blocks procedure:85 -- \"if a conversion was wrong, use `anno_undo` to revert\"",
  "sites": ["an upstream blocks procedure:85"]
}
```

**There is currently NO `requirement_id` on this entry.** Only `anno_toggle_splitter`
(`"requirement_id": "DECOMP-01"`, manifest:41) and `anno_set_immediate_format`
(`"requirement_id": "BUILD-03"`, manifest:49) carry one — exactly as trigger 3's mechanism
says. **Adding one to `anno_undo` is criterion 2's named delta.**

### Which direction the decision actually goes

**The omission STANDS. `omit` because the criterion arrived and was answered a different way.**

The criterion v0.7.0 supplies is **`STORE-04`**, and decision **`D2`** is the record of how it
was answered. `D2` verbatim:

> **`D2` undo → whole-store snapshot/restore, not a per-edit inverse journal.**
> Measured: zero callers anywhere, and the Phase 19 manifest already disposes
> `anno_undo` as `omit` because idempotent range typing collapses "undo the wrong
> conversion" into "set it correctly". Node's `sqlite` surface also does not expose
> `sqlite3changeset_invert`, confirmed two independent ways. `STORE-04` is scoped
> to what a planted-violation test can actually prove.

[VERIFIED: .planning/REQUIREMENTS.md:46-51]

`STORE-04` verbatim: *"The store survives a process restart and **an edit can be reverted**,
proven by **one combined planted-violation test** — mutate → `SIGKILL` with no clean close →
fresh process → reopen → read returns the mutation → revert returns the prior value…"*
[VERIFIED: .planning/REQUIREMENTS.md:85, recorded `Complete` against Phase 28 at :227].

And the Out-of-Scope table:
> `| A per-edit inverse-command undo journal | `D2`. Zero callers measured; the Phase 19 manifest disposes `anno_undo` as `omit`; Node's `sqlite` does not expose `sqlite3changeset_invert`. Whole-store snapshot/restore serves the requirement that has a consumer |`

[VERIFIED: .planning/REQUIREMENTS.md:202]

**The route that satisfies `STORE-04` is a store-layer function, not a surface verb:**
`export function revertTo(handle: AnnoStoreHandle, revision: number): AnnoStoreHandle`
[VERIFIED: src/mcp/vice/anno-store.ts:2458]. It has **no MCP verb caller** — every reference
outside tests is a comment [VERIFIED: `grep -rn "revertTo" src/mcp/vice/*.ts` excluding
`.test.`: only `anno-register.ts:156`, `anno-types.ts:135,589`, and `anno-store.ts`'s own
comments].

**The surface carries no undo verb under any spelling.** Executed against the live module:

```
count: 19
anno_set_label_name anno_set_comment anno_set_data_type anno_add_scope anno_remove_scope
anno_get_symbols anno_get_comments anno_get_blocks anno_create_project_enum
anno_update_project_enum anno_apply_enum_usage anno_save_project anno_disassemble
anno_read_region anno_get_binary_info anno_get_cross_references anno_search
anno_get_address_details anno_batch_execute
has anno_undo: false     has undo: false     has anno_revert: false
```
[VERIFIED: `node -e "import('./anno-tools.ts')…"` in `src/mcp/vice`, 2026-08-31]

**So the correct record is:** `disposition` stays `"omit"`; `requirement_id` becomes
`"STORE-04"`; and the justification must state that the criterion **arrived and was
discharged by whole-store snapshot/restore at the store layer (`revertTo`), deliberately not
exposed as a surface verb** — per `D2` — so the omission is now a *decided* omission with a
named criterion rather than an unexamined one.

### The assertion that would catch a reversal — quoted

Two, and they catch different reversals.

**(a) The justification/disposition assertion in `anno-derivation.test.ts`** — this is the one
criterion 2 names:

```ts
// VERBATIM from src/mcp/vice/anno-derivation.test.ts:196
assert.notEqual(entry.disposition, "curated", `${name}: is not curated, so its rationale must not claim it is`);
```

and immediately around it, the shape gate on the new field:

```ts
// VERBATIM from src/mcp/vice/anno-derivation.test.ts:207-213
if (entry.requirement_id !== undefined) {
  assert.match(
    entry.requirement_id,
    /^[A-Z][A-Z0-9]*-\d+$/,
    `${name}: requirement_id "${entry.requirement_id}" is not a requirement ID`
  );
}
```

`"STORE-04"` matches `/^[A-Z][A-Z0-9]*-\d+$/`. **`requirement_id` is optional**, so adding one
cannot break the schema.

**(b) The manifest ↔ surface agreement, which is what actually catches a *reversed* decision:**

```ts
// VERBATIM from src/mcp/vice/anno-derivation.test.ts:159-163
assert.equal(
  disposition === "curated",
  curated,
  `${procedure.path}: ${name} is disposed "${disposition}" but the surface ${curated ? "does" : "does not"} carry a dedicated route for it (${annoNameFor(name)})`
);
```

plus, in `derivationVerdict()`:

```ts
// VERBATIM from src/mcp/vice/anno-derivation.test.ts:371-380
} else if (disposition === "omit") {
  omitted.add(upstream);
  for (const spelling of omitSpellings(upstream)) {
    if (names.has(spelling)) {
      problems.push(
        `${upstream} is disposed "omit" in ${procedure.path} but ${spelling} IS on the surface -- ` +
          "an omission the manifest justified and cited has been quietly reversed",
      );
    }
  }
}
```

**Flipping `anno_undo` to `"curated"` goes red immediately** at `:159` — the surface has no
`anno_undo`, so `curated` is `false` while `disposition === "curated"` is `true`. That is the
mechanical protection against the reversal criterion 2 warns about. Note also
`MEASURED_OMITTED_MINIMUM = 4` [VERIFIED: anno-derivation.test.ts:403] — dropping an omit
entry below four fails the non-vacuity counter.

## Finding 6 — The "same commit" constraint

**It is NOT enforced mechanically as a diff-based check. Say so plainly: the plan must obey
it, not build it.**

- No script or test inspects a commit diff for co-changed files. The only `execFileSync("git",…)`
  in the checked set is the removal gate's `git ls-files` scope query [VERIFIED: `grep -rln`
  across `src/mcp/vice/*.test.ts` and `scripts/*.mjs` → only
  `scripts/check-no-analyser.mjs`].
- What *does* exist is a **state invariant that must hold at every commit**:
  `anno-derivation.test.ts:159-163` and `derivationVerdict()` fail whenever the manifest and
  the surface disagree, in either direction. Because CI runs on every commit and the project's
  own doctrine is that each commit must be green, that invariant **forces** manifest and
  surface changes into the same commit — indirectly and only for changes the invariant can
  see (dispositions vs. surface verb names).
- **It cannot see prose.** A stale `anno-tools.ts` reference inside a `mechanism` or
  `justification` string satisfies every assertion (`typeof … === "string" && .trim().length > 0`,
  and a `/:\d+/` match on `upstream_citation`). Which is precisely why the drift in Finding 4
  survived Phase 29 in full.
- Nearby precedents to imitate rather than reinvent: the removal gate's own message —
  *"a mention that moved must move its pin in the same commit, and a mention that multiplied
  is a reintroduction"* [VERIFIED: scripts/check-no-analyser.mjs:912] — and
  `MCP-05`'s *"each guard moved in the commit that broke it"*.

**Recommendation for the planner:** encode it as a **single-task, single-commit** plan whose
`<verify>` block runs the two manifest-reading tests plus the removal gate, and whose
acceptance criterion is an explicit `git show --stat` naming the manifest. Do **not** build a
new diff-inspecting gate — that would be a novel enforcement mechanism this phase's criteria
do not ask for, and the state invariant already covers the failure mode that matters.

## Finding 7 — Test-running mechanics (measured on a clean tree, 2026-08-31)

### The command a plan's `<verify>` block should use

```bash
cd src/mcp/vice && npm run test:automated
```

This is the project's configured `workflow.test_command` [VERIFIED: .planning/config.json
`"test_command": "cd src/mcp/vice && npm run test:automated"`], and `workflow.build_command`
is `cd src/mcp/vice && npm run typecheck`.

**`npm test` (the full glob) must NOT be used locally** — it blocks forever on
`vice-proxy.test.ts`. `test:automated` runs `node test-gate.mjs`, which is
`node --test <every *.test.* minus the nine manual-only files>`:

```js
// VERBATIM from src/mcp/vice/test-gate.mjs:95-105
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
  "stock-live.test.ts",
  "stock-live-triage.test.ts",
  "stock-live-broker-monitor.test.ts",
  "stock-broker-live.test.ts",
  "fork-live.test.ts",
  "stock-a4-checkpoint-flood.test.ts",
]);
```

### `test:automated` carries NO failure baseline

Read the source: `main()` is `process.exit(runNodeTest(files))` and `runNodeTest` returns
`result.status ?? 1` [VERIFIED: src/mcp/vice/test-gate.mjs:113-129]. There is no
allowed-failure count anywhere in the file. **The clean floor is 0 failures.** (Older
project memory describing a 5-, 7- or 44-failure baseline is superseded — do not plan against
those numbers.)

### Measured clean-tree result

```
# tests 2918
# suites 24
# pass 2912
# fail 0
# cancelled 0
# skipped 1
# todo 5
# duration_ms 46897.96
EXIT=0
```
[VERIFIED: `cd src/mcp/vice && npm run test:automated`, 2026-08-31, ~47s wall clock]

Every other repository gate, same tree, same session:

| Gate | Result |
|------|--------|
| `npm run typecheck` | exit 0 |
| `node scripts/check-no-analyser.mjs` | exit 0 — 400 files scanned, 157 exempt, temporary allow-list **empty** |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 |
| `node scripts/check-skill-cli-invocations.mjs` | exit 0 |
| `node scripts/check-npm-packages.mjs` | exit 0 |

[VERIFIED: each command run individually, 2026-08-31]

### Live-broker interference

**No broker was running during these measurements** — `pgrep -af "vice-broker|x64sc"` matched
only this session's own shell, and `systemctl --user is-active vice-broker` → `inactive`
[VERIFIED]. So the 0-failure result is a genuine clean-broker baseline. A running broker
**deterministically** reddens the BACK-05 test; **stop the broker before trusting any
`npm test` result**, and if a plan's verify block reports a BACK-05 failure, check the broker
before treating it as a regression.

### The four meta-tests most likely to react

| Test | Will it react to this phase? | Why |
|------|------------------------------|-----|
| `docs-linerefs.test.ts` | **No, unless CLAUDE.md's Architecture bullet is touched.** It extracts `vice-proxy.ts:<N>` citations from CLAUDE.md and asserts each cited line contains `rewriteArguments(` or a `function` keyword [VERIFIED: docs-linerefs.test.ts header]. This phase touches neither file. Currently green |
| `removal-gate.test.ts` | **Only if `check-no-analyser.mjs` is edited.** It imports the gate's real exported predicates and drives four planted evasion routes through them. Editing an exemption's `why` string is inert to it; editing `SKILL_ATTRIBUTION_PINS`, `isInsideSkillAttributionBlock` or `SUBJECT_NEEDLE` is not. Currently green |
| `audit-integrity.test.ts` | **Low risk.** Its numeric checks are floors and relations (`json.auditFiles.length >= 6`), not growing census pins [VERIFIED: `grep` for numeric assertions]. It drives `scripts/audit-gate.mjs`'s real CLI. It reacts if a `docs-*.test.ts` file is **added** (then `EXPECTED_DOCS_GUARD_NAMES` and `DOCS_GUARD_FLOOR` must move in the same commit — its own message says so at `:266`). **So: do not name any new test file `docs-*.test.ts`** |
| `docs-review-disposition.test.ts` | **Yes, at code-review time.** It derives every finding id from every `*-REVIEW.md` under `.planning/phases/` and requires each to be mentioned in a recognised disposition source. A first-time `31-REVIEW.md` reddens it until dispositions exist. Known remedy: run the code-review disposition fix with `--fix --all` so Info-severity ids also get dispositions |

Also worth knowing: **running the removal gate regenerates `installer/skills/`** as a side
effect (it calls `packFiles()` → `npm pack --dry-run` → `prepack` → `sync-skills.mjs`). That
is by design — *"the list is post-sync BY CONSTRUCTION, and a 'remember to sync first'
predicate can forget"* [VERIFIED: scripts/check-no-analyser.mjs:20-24] — and it never
dirties git, because `installer/skills` is gitignored. `git status --porcelain` after all the
above showed only four pre-existing untracked files, none of them under `installer/` or
`src/skills/` [VERIFIED].

**CI runs a wider set than local.** CI's Test step is `npm test` (the full glob) with
`VICE_REQUIRE_ACME: "1"`, deliberately, with a long comment recording the run id that decided
it [VERIFIED: .github/workflows/ci.yml:110-141]. A plan should not try to reproduce CI's
command locally.

## Finding 8 — What is genuinely LEFT to do

### Already discharged — MUST NOT be redone

| Thing | Evidence it is done |
|---|---|
| Re-pointing the 10 skill files onto the `anno_*` family | 29-09-SUMMARY.md; `REPOINT-01`/`REPOINT-02` = `Complete` @ Phase 29 [.planning/REQUIREMENTS.md:239-240] |
| Rewriting `routine-queue-walker`'s `description:` substantively | The text names *"an existing C64 annotation store"*; zero analyser mentions outside the attribution block |
| Moving CLAUDE.md's project-skills row in the same commit | Gate reports *"7 rows, all byte-identical to their SKILL.md"* |
| The `ABS-02` headers' permanent, bidirectional exemption | `skill-attribution-headers` class with `blocks` **and** `hits` pins in both trees |
| `packer-finding.mjs`'s provenance fate | `surviving-provenance` exemption, 1 hit each tree |
| The `installer/skills/` twin's re-pointing, proven against the **shipped** copy | `check-npm-packages.mjs` exit 0; `diff -rq` clean |
| The `ANNO-14`/`ANNO-15` withdrawal-note correction | Already present and dated 2026-08-31 in **both** `PROJECT.md:141` and `REQUIREMENTS.md:73` [VERIFIED] — the ROADMAP Note's "corrected in the same change" is true; **nothing to do** |
| `scripts/check-skill-tool-coverage.mjs`'s raised floor over the new prefix | exit 0 |

### Criterion 1 — already TRUE on disk; the work is producing the evidence

Criterion 1 is **fully satisfied by the tree as it stands.** That is still work — a
verification pass that *records the measurement* — but it is **not an edit**. The evidence
that scores it:

| Clause | Evidence that scores it | Currently |
|---|---|---|
| "10 instances across two trees" | `grep -ro "ATTRIBUTION (ABS-02)" src/skills installer/skills \| wc -l` → 10; plus the gate's six per-file `blocks` pins summing to 10 | ✅ 10 |
| "each with its two naming lines byte-identical" | `grep -rx` on each of the two exact strings across both trees → 10 and 10; plus `diff -q` per file | ✅ 10/10, all three files IDENTICAL |
| "the chain is intact after the change" | `node --test skill-attribution.test.ts` | ✅ 0 failures |
| "`description:` changes substantively rather than being worked around" | The text itself + 29-09's record + zero analyser mentions in it | ✅ done in 29-09 |
| "`ABS-03`'s pairwise check passes on the rewritten text" | `node scripts/check-skill-description-overlap.mjs` OK line: 21 pairs, max 0.250 < 0.35, allowlist 0 | ✅ pass |

**The one genuine gap: no instrument asserts the two-naming-lines claim directly.**
Recommended edit (small, additive, low-risk): extend `src/mcp/vice/skill-attribution.test.ts`
with one test that (a) walks **both** `src/skills` and `installer/skills`, (b) asserts each of
the two naming lines occurs **exactly 10 times** total (or 5 per tree), (c) asserts the two
per-tree counts are **equal to each other** rather than to a literal, so a future eighth
absorbed block does not red a correct tree, and (d) carries a non-vacuity floor and an
in-memory planted violation, per this file's own five-way rot doctrine. Pin the two strings as
named constants with a comment saying they are *the* naming lines. **Do not** assert adjacency
(one block orders them non-adjacently — see Finding 1).

### Criterion 2 — real edits, in one commit

| # | Delta | File:line | Kind |
|---|---|---|---|
| 1 | `anno-derivation.test.ts` → `anno-derivation.test.ts` in trigger 1's mechanism | manifest:13 | live instruction — **must** re-point |
| 2 | `CURATED_ANNO_TOOLS` → `CURATED_ANNO_TOOLS`; `anno-tools.ts` → `anno-tools.ts` in **trigger 3's mechanism** | manifest:21 | live instruction — **must** re-point (this is the criterion's own anchor) |
| 3 | Add `"requirement_id": "STORE-04"` to `anno_undo`, and rewrite its justification to state the direction: criterion arrived, answered by whole-store snapshot/restore (`anno-store.ts` `revertTo`), **omission stands** | manifest:31-36 | new field + prose |
| 4 | Re-point `anno-tools.ts` in the three other justifications | manifest:27, :33, :47 | prose |
| 5 | Re-point `anno-session.ts`'s FIFO-mutex sentence — no module of that name exists; state the store's actual single-writer discipline or mark the sentence dated | manifest:47 | prose |
| 6 | Decide the fate of `SURF-01`/`SURF-03` and `Phase 20`/`Phase 20/21`/`Phase 21`: these are **dated historical citations**, and the project's own convention is *keep the fact, date it, retire the live token*. Recommend a short dated parenthetical rather than deletion | manifest:17, :27, :39, :47, :54 | prose (discretionary) |
| 7 | Note that `anno_toggle_splitter`'s named blocker was closed by `STORE-02` "by construction" — the entry's `DECOMP-01`/`BUILD-02` ids stay (re-mapped to v0.9.0, still live) | manifest:39 | prose (discretionary) |
| 8 | Correct the two `"ROADMAP Phase 31 criterion 4"` citations — Phase 31 now has **two** criteria and the attribution one is **criterion 1** (`D-01` narrowed the phase) | `scripts/check-no-analyser.mjs:293`, `:523`; also `.planning/STATE.md:718` | prose (discretionary but cheap; editing an exemption's `why` string is inert to `removal-gate.test.ts`) |

### Status records to move (the phase's own bookkeeping)

| Record | From | To |
|---|---|---|
| `.planning/REQUIREMENTS.md:120` `REPOINT-03` | `- [ ]` | `- [x]` |
| `.planning/REQUIREMENTS.md:121` `REPOINT-04` | `- [ ]` | `- [x]` |
| `.planning/REQUIREMENTS.md:241-242` traceability | `Pending` | `Complete` |
| `.planning/ROADMAP.md:1151` progress row | `\| 31. Procedure Re-pointing \| v0.7.0 \| — \| Not started \| - \|` | Complete, with the plan count |
| `.planning/ROADMAP.md` Phase 31 `**Plans**: TBD` | `TBD` | the real plan list |
| `.planning/STATE.md` frontmatter + Current Position + Decisions | Phase 31 planning | Phase 31 complete |

**A plan delivering `ROADMAP.md` or `STATE.md` content needs `USE_WORKTREES_FOR_PLAN=false`.**
`REQUIREMENTS.md` and the manifest are unaffected by that rule.

## Runtime State Inventory

This phase edits records, not code. The inventory is included because record-correction
phases have their own analogue of runtime state — *derived* and *shipped* copies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No database, no store, no `.annostore` is read or written by anything this phase changes. Verified: the manifest is a JSON planning artifact with two test readers; no runtime module imports it (`grep -rln "upstream-procedure-manifest"` over `src/mcp/vice/*.ts` returns only `anno-derivation.test.ts`) | none |
| Live service config | **None.** No emulator, broker, MCP server or external service is involved. `systemctl --user is-active vice-broker` → `inactive` | none |
| OS-registered state | **None.** No task, unit, plist or registered process names anything this phase changes | none |
| Secrets / env vars | **None changed.** Two env var names are *read* by the tests this phase runs — `ANNO_UPSTREAM_CLONE` and `VICE_REQUIRE_ANNO_UPSTREAM` — and both are **deliberately left byte-identical** even across the family rename: *"an environment variable is a name CI binds by, so renaming one silently turns a hard-gated check into a skipped one"* [VERIFIED: anno-derivation.test.ts:6-10]. **Do not rename either.** Neither is set in `ci.yml` [VERIFIED: anno-derivation.test.ts:91-92 states this; `grep` of ci.yml confirms] | none — and a hard prohibition on renaming |
| **Derived / shipped copies** (this phase's real analogue) | **`installer/skills/` is gitignored yet shipped.** `git ls-files installer/skills` returns 0 while the tarball carries it. It is regenerated by `installer/scripts/sync-skills.mjs` via `prepack`, and any consumer of `packFiles()` triggers that regeneration. Currently byte-identical to `src/skills/` for all three absorbed playbooks | If any `src/skills/` file were edited, prove the twin with `node scripts/check-npm-packages.mjs`, never with `git status`. **This phase should not edit `src/skills/` at all** |
| Build artifacts | **None.** No `.mts` → `resources/*.mjs` compilation is involved (`build.ts` is untouched), so `resources-sync.test.ts` cannot drift. No `egg-info`/binary equivalents in this stack | none |

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────────────────────────────────┐
                     │  UPSTREAM (the external analyser, PINNED)      │
                     │  commit 493f8404…  v0.9.20  2026-07-11   │
                     │  5 procedure files, sha256 each          │
                     └───────────────┬──────────────────────────┘
                                     │ absorbed once, Phase 19
                                     ▼
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  THE SNAPSHOT RECORD                                                    │
   │  .planning/phases/19-…/upstream-procedure-manifest.json                 │
   │    • commit / licence / elected_licence      • procedures[5] + sha256    │
   │    • resync_triggers[3] (trigger + mechanism)                            │
   │    • disposition_rationale{} (justification + citation [+ req id])       │
   └───┬───────────────────────────────┬─────────────────────────┬───────────┘
       │ (a) commit + per-row sha256   │ (b) dispositions        │ (c) triggers
       ▼                               ▼                         ▼
 ┌──────────────────┐        ┌───────────────────────┐   ┌──────────────────┐
 │ ABS-02 HEADERS   │        │ anno-derivation.      │   │ (prose only —    │
 │ 5 blocks / 3     │◄──────►│ test.ts               │   │  NO mechanical   │
 │ files, src/skills│ digest │  FORWARD: curated →   │   │  reader)         │
 │ + 5 synced twins │ equal? │   route exists        │   │  ← THE DRIFT     │
 │ = 10 instances   │        │   omit → absent under │   │    LIVES HERE    │
 │  each with 2     │        │   any spelling        │   └──────────────────┘
 │  naming lines    │        │  BACKWARD: every verb │
 └───┬──────────┬───┘        │   classified or in    │
     │          │            │   the register        │
     │          │            └───────────┬───────────┘
     │          │                        │ reads
     │          │                        ▼
     │          │            ┌───────────────────────────────┐
     │          │            │ THE LIVE SURFACE              │
     │          │            │ anno-tools.ts                 │
     │          │            │  ANNO_TOOL_DEFINITIONS (19)   │
     │          │            │  CURATED_ANNO_TOOLS (derived) │
     │          │            │  ✗ no anno_undo / anno_revert │
     │          │            └───────────────────────────────┘
     │          │
     │          └──► skill-attribution.test.ts  (src/skills ONLY)
     │                 6 fields · digest · adaptation stmt · absence
     │
     └──► check-no-analyser.mjs  (BOTH trees, BLOCK-scoped)
            scope = (git ls-files − ".planning/") ∪ packFiles("installer")
            blocks pin + hits pin per file → deleting a header FAILS
                                                    │
   ┌────────────────────────────────────────────────┘
   ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ ABS-03 — TRIGGER UNIQUENESS (the `description:` line, not the    │
 │ attribution)                                                     │
 │   check-skill-description-overlap.mjs  ──uses──►                  │
 │   scripts/lib/skill-descriptions.mjs  ◄──uses──                  │
 │   skill-description-overlap.test.ts                              │
 │   7 skills → 21 pairs → max Jaccard 0.250 vs threshold 0.35      │
 │   + CLAUDE.md project-skills table byte-identity (7 rows)        │
 └──────────────────────────────────────────────────────────────────┘
```

### Recommended plan structure

```
Plan 31-01  (worktree OK — no ROADMAP/STATE content)
  └─ ONE task, ONE commit: the manifest re-point + anno_undo's requirement_id
       edits:  .planning/phases/19-…/upstream-procedure-manifest.json
       verify: node --test anno-derivation.test.ts skill-attribution.test.ts
               node scripts/check-no-analyser.mjs
               git show --stat  (proves the same-commit property)

Plan 31-02  (worktree OK)
  └─ The naming-line assertion
       edits:  src/mcp/vice/skill-attribution.test.ts
       verify: planted violation observed RED, then reverted
               npm run typecheck && npm run test:automated

Plan 31-03  (USE_WORKTREES_FOR_PLAN=false — delivers ROADMAP.md + STATE.md)
  └─ The status records + the stale criterion-4 citations
```

### Pattern 1: Re-point a live instruction; date a past-tense fact

**What:** When a record names something that was deleted or renamed, the disposition depends on
whether the sentence is an **instruction a future reader would follow** or a **fact about a
past run**.
**When to use:** Every one of the eight manifest deltas in Finding 8.
**Example — the project's own precedent, stated in its own words:**

```
// VERBATIM from scripts/check-no-analyser.mjs:496-502
"packer-finding.mjs joined this class on 2026-08-29 (plan 29-09): its remaining mention
is a DATED past-tense provenance paragraph recording that the retired analyser computed
a packer identity and threw it away before any machine-readable surface … Its
tool-name-shaped literal was RETIRED in the same commit, so what is left is a fact and
not a route."
```

Applied here: trigger 3's `CURATED_ANNO_TOOLS` / `anno-tools.ts` are a **route** → re-point.
`SURF-01`'s "in SURF-01's pattern" is a **fact about what was decided in Phase 19** → date it,
don't delete it.

### Pattern 2: A guard whose subject was renamed is RE-POINTED, never dropped

**What:** The comparison keeps its meaning by moving onto the surviving subject.
**Example — exactly what plan 29-10 did to the assertion this phase's criterion 2 names:**

```
// VERBATIM from src/mcp/vice/anno-derivation.test.ts:56-63
// `CURATED_ANNO_TOOLS` is ALSO used by the upstream-integrity half above, as
// of plan 29-10: that half used to compare the manifest's `curated`
// dispositions against the retired analyser's own curated set, and that set
// was deleted with the module holding it. The comparison was RE-POINTED onto
// the surviving surface rather than removed -- a guard dropped because its
// subject was renamed is the drift it exists to catch -- carrying
// `annoNameFor()`, the upstream-to-surface mapping plan 29-08 added, so the
// comparison keeps its meaning instead of becoming a rename.
```

**The manifest's trigger 3 is the same edit, one document over, and it was missed.**

### Pattern 3: A relation plus a floor, never a growing exact count

**What:** Assert relations between two independently-maintained records, plus a non-vacuity
floor. Never pin a number that grows.
**Why it matters here:** the naming-line assertion must not hard-code `10` as an equality that
a future eighth block would red. The project has paid for this once already — the description
gate's own header records *"a census assertion pinned to an exact count goes red on a correct
tree the day a skill is added, and this project has already paid for that once (the installer
skill-count pin, fixed in 19-01 by making it a relation plus a floor rather than a 6→7 bump)"*
[VERIFIED: scripts/check-skill-description-overlap.mjs:40-46].
**Recommended shape:** assert `srcCount === installerCount` (the relation), `srcCount >= 5`
(the floor), and `adaptedCount === repositoryCount` (the two lines must travel together).

### Pattern 4: Non-vacuity, five ways

`skill-attribution.test.ts`'s header enumerates the five ways it refuses to rot into a no-op
(registry length non-zero; every row's file must exist; the predicate proven to bite on an
**in-memory** plant; the registry's length **and** path set equal to the manifest's; the phrase
set non-empty and proven to bite). **A new test in that file must carry the same properties,
and its plant must live only in memory** — *"a plant-and-revert against the real tree would
leave the working tree dirty between runs"* [VERIFIED: skill-attribution.test.ts:56-59].

### Anti-Patterns to Avoid

- **Rewriting `routine-queue-walker`'s `description:`.** It is done. Rewriting it re-triggers
  `ABS-03` **and** breaks CLAUDE.md's byte-identity assertion, for no gain.
- **Driving `grep -rail 'the external analyser' installer/skills` toward 0.** Unsatisfiable by
  design. It requires deleting attributions from the shipped tarball, which `CUT-03`, the
  removal gate's bidirectional pins, and `skill-attribution.test.ts` all forbid.
- **Replacing the frozen registry with a corpus scan.** *"That check is circular: a file whose
  header was deleted stops matching and silently stops being checked"*
  [VERIFIED: skill-attribution.test.ts:67-69].
- **Widening the removal gate's scope to `.planning/`.** The prefix exclusion is deliberate and
  load-bearing; `docs-dangling-refs.test.ts` states the same reasoning for
  `.planning/phases/**`. Widening either produces false positives on historical records and the
  guard gets switched off.
- **Flipping `anno_undo` to `"curated"`.** The reversal criterion 2 exists to prevent. It
  goes red at `anno-derivation.test.ts:159` — but *only if the test is run*, which is why it
  must be in the plan's verify block.
- **Deleting a re-sync trigger instead of re-pointing its mechanism.**
  `assert.ok(manifest.resync_triggers.length >= 2)` tolerates dropping the third, so the
  guard would not notice. Don't.
- **Naming a new test file `docs-*.test.ts`.** It joins `audit-gate.mjs`'s globbed guard set
  and `audit-integrity.test.ts` reds until `EXPECTED_DOCS_GUARD_NAMES` and `DOCS_GUARD_FLOOR`
  move in the same commit.
- **Importing `hostpath.ts`/`containerpath.ts`** into either test — both files' headers forbid
  it and `hostpath-consumers.test.ts` asserts the exclusion.
- **Building a diff-inspecting "same commit" gate.** Not asked for; the state invariant plus a
  single-commit plan is the project's own answer.
- **Editing anything under `installer/skills/` by hand.** It is generated. Edit `src/skills/`
  (which this phase shouldn't need to) and let `sync-skills.mjs` do the rest.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proving the shipped twin tree matches | A `git`-based diff or a "remember to sync" checklist | `node scripts/check-npm-packages.mjs` (and `packFiles()` for programmatic use) | `git ls-files installer/skills` returns **0** — a tracked-files predicate is structurally blind to exactly what users receive. `packFiles()` runs `prepack`, so the list is post-sync by construction |
| Counting the attribution blocks | A fresh regex | `attributionBlocks()` / `skillAttributionBlocks()` / `isInsideSkillAttributionBlock()` — all exported | The gate and the test must agree on block boundaries **by construction**; that agreement is 29-09's stated pattern. Two regexes agree only until one changes (the WR-12 lesson) |
| Walking the skills corpus | `readdirSync` recursion | `walkSkills()` / `topLevelSkillDirs()` from `scripts/lib/skill-corpus.mjs` | One walker, shared by three gates. `check-skill-description-overlap.mjs` explicitly *"derives no second walker"* |
| Parsing a SKILL.md `description:` | A new YAML parse | `parseSkillFrontmatter()` from `scripts/lib/skill-descriptions.mjs` (or `skillDescription()` inside `skill-attribution.test.ts`) | The normalisation and clause-splitting are measured, not chosen; a second parser would disagree at the margins |
| Mapping an upstream verb to a surface verb | A prefix swap | `annoNameFor()` in `anno-derivation.test.ts:314-327` | It is *"The ONE MAPPING … Total over every upstream name, with EXACTLY TWO documented departures"*, and it is deliberately **not injective** |
| Detecting a reversed omission | A hand grep for `anno_undo` | Run `anno-derivation.test.ts` | It checks **all four** omit verbs, under **two spellings each**, order-independently, with a non-vacuity counter |
| Repo-root resolution in a test | `join(__dirname, "../../..")` | `repoRoot({ from: HERE })` from `repo-root.ts` | The one shared resolver; `hostpath.ts`/`containerpath.ts` are forbidden here |

**Key insight:** every artefact this phase touches already has *two* independently-maintained
guardians whose whole value is that they were written separately and must **agree**. The
correct move is always to re-point or extend an existing guardian, never to add a third
opinion — a third opinion is how a record starts answering one question two different ways,
which is the failure mode `audit-integrity.test.ts` and the ROADMAP's own `MCP-04` correction
note both exist against.

## Common Pitfalls

### Pitfall 1: Reading "v0.7.0 supplies a criterion for `anno_undo`" as "add undo"

**What goes wrong:** A plan adds `anno_undo` to the surface, or flips the manifest disposition
to `"curated"`, or writes a justification saying undo is now needed.
**Why it happens:** The requirement text *"`anno_undo`'s `omit` disposition is one v0.7.0
supplies a criterion for"* reads, at a glance, like "the criterion has now been met, so add
it". The two sibling entries reinforce it — `toggle_splitter` and `set_immediate_format` both
name a requirement that *would* justify adding them.
**How to avoid:** Read `D2` and the Out-of-Scope row first. `STORE-04`'s revert **is**
delivered, but as **whole-store snapshot/restore at the store layer** (`revertTo` in
`anno-store.ts`), deliberately **not** a surface verb, and *"A per-edit inverse-command undo
journal"* is explicitly Out of Scope. The criterion's arrival is what lets the omission
become a *decided* one — it does not reverse it.
**Warning signs:** any diff adding a verb name containing `undo`; any manifest diff changing
`"disposition": "omit"` on `anno_undo`; `anno-derivation.test.ts` going red at the
`assert.equal(disposition === "curated", curated, …)` line.

### Pitfall 2: Deleting a stale citation instead of dating it

**What goes wrong:** `SURF-01`, `SURF-03`, `Phase 20/21` and the `anno-session.ts` sentence
are simply removed, taking with them the record of *why* each disposition was decided.
**Why it happens:** They are unambiguously stale, and deletion is the shortest diff.
**How to avoid:** This project's convention, stated repeatedly and enforced by
`docs-absorbed-decisions.test.ts` and the removal gate's own exemption prose, is **keep the
fact, date it, retire the live token**. The manifest is a *dated snapshot record* — its
justifications are decisions made at a pinned moment, and a decision with its reasoning
deleted is indistinguishable from an oversight a year later (which is `anno-derivation.test.ts`'s
own stated rationale for requiring justifications at all).
**Warning signs:** a manifest diff with more deleted lines than added ones.

### Pitfall 3: Asserting adjacency of the two naming lines

**What goes wrong:** A new assertion requires `Adapted from the external analyser.` to be
immediately followed by `  Source repository: …`. It goes red on
`src/skills/c64-program-recon/SKILL.md`'s second block, where `Source path:` sits between them
(`:571` and `:577`).
**Why it happens:** Four of the five blocks *are* adjacent, so a sample of one or two suggests
adjacency is the rule.
**How to avoid:** Assert **counts and byte-identity of each line**, never their relative
position. `skill-attribution.test.ts`'s existing field checks are deliberately
order-independent for the same reason (`block.indexOf(field)` per field, no ordering).
**Warning signs:** the assertion passing on `routine-queue-walker` and failing on
`c64-program-recon`.

### Pitfall 4: Hard-coding `10` as an equality

**What goes wrong:** The naming-line count is pinned at exactly 10 and reds the day a sixth
procedure is absorbed — the exact defect the installer skill-count pin caused in Phase 19.
**How to avoid:** Relation (`src === installer`, `adapted === repository`) plus a floor
(`>= 5` per tree). The registry itself models this: `ABSORBED_FILES.length ===
manifest.procedures.length` with the comment *"Deliberately not a literal 5"*.
**Warning signs:** any `assert.equal(count, 10)`.

### Pitfall 5: Believing the manifest edit is covered by CI

**What goes wrong:** The plan skips its own verification, assuming the removal gate or a docs
guard would have caught the stale references.
**Why it happens:** The repo has ~400 files under a removal gate and eight CI gates; it feels
comprehensively covered.
**How to avoid:** Internalise the two scope exclusions — the gate's `.planning/` **prefix**
exclusion, and `docs-dangling-refs.test.ts`'s deliberate `.planning/phases/**` exclusion.
Both are correct and neither should be widened. **The manifest's prose has no mechanical
reader at all.** That is the reason `REPOINT-04` is a requirement rather than a CI job.
**Warning signs:** a plan whose only verification is "CI is green".

### Pitfall 6: A stale `resync_triggers` entry passing silently

**What goes wrong:** Trigger 3's mechanism is re-pointed but trigger 1's is missed, and every
test still passes.
**Why it happens:** `anno-derivation.test.ts` only checks that each `mechanism` is a non-empty
string. It has no opinion about whether the mechanism names anything real.
**How to avoid:** Grep the manifest for every deleted symbol and module name explicitly —
`anno-tools`, `anno-session`, `anno-upstream-audit`, `CURATED_ANNO_TOOLS` — and make each
hit an acceptance criterion of the plan, so the *plan* is the reader the manifest lacks.
**Warning signs:** a re-point diff that touched only line 21.

### Pitfall 7: Treating a first-time `31-REVIEW.md` failure as a regression

**What goes wrong:** After code review, `docs-review-disposition.test.ts` goes red and time is
spent hunting a defect.
**How to avoid:** It is expected — a new REVIEW.md's finding ids need dispositions. Fix with
the code-review disposition pass in `--fix --all` mode so Info-severity ids get dispositions
too.

## Code Examples

### Measuring the `ABS-02` chain (the exact commands that produced Finding 1)

```bash
# 10 blocks across both trees
grep -ro "ATTRIBUTION (ABS-02)" src/skills installer/skills | wc -l          # → 10

# the two naming lines, exact-line match, across both trees
grep -rx "Adapted from the external analyser." src/skills installer/skills | wc -l  # → 10
grep -rx "  Source repository: an upstream repository" \
     src/skills installer/skills | wc -l                                      # → 10

# byte-identity of the three absorbed playbooks between the trees
for d in routine-queue-walker c64-memory-mapping c64-program-recon; do
  diff -q "src/skills/$d/SKILL.md" "installer/skills/$d/SKILL.md"
done                                                                          # → silent
```

Note `grep -a` is not needed for these files, but **is** required for
`src/mcp/vice/anno-memmap-render.ts`, which carries a literal NUL at offset 12862 and which
GNU grep therefore skips under `-c`/`-o`. Any census this phase takes over `src/mcp/vice/`
must use `grep -a`.

### The block-boundary predicates to reuse (never re-derive)

```js
// Source: src/mcp/vice/skill-attribution.test.ts:192-194
function attributionBlocks(text: string): string[] {
  return [...text.matchAll(/ATTRIBUTION \(ABS-02\)([\s\S]*?)-->/g)].map((m) => m[1]);
}
```

```js
// Source: scripts/check-no-analyser.mjs:326-328 (exported)
export function isInsideSkillAttributionBlock(text, line) {
  return skillAttributionBlocks(text).some((b) => line >= b.firstLine && line <= b.lastLine);
}
```

The gate anchors on *"the same `ATTRIBUTION (ABS-02)` marker `skill-attribution.test.ts`
anchors on"* [VERIFIED: scripts/check-no-analyser.mjs:524-526] — that shared anchor is
the pattern. A new assertion should use the same marker.

### The bidirectional protection, so a plan does not accidentally weaken it

```js
// Source: scripts/check-no-analyser.mjs:987-996
for (const [rel, pin] of Object.entries(SKILL_ATTRIBUTION_PINS)) {
  const abs = join(ROOT, rel);
  const blocks = existsSync(abs) ? skillAttributionBlocks(readFileSync(abs).toString("utf8")).length : -1;
  need(
    blocks === pin.blocks,
    `CUT-03: ${rel} carries ${blocks} ABS-02 attribution header(s), expected exactly ${pin.blocks}. A LOWER ` +
      `count means an attribution header was deleted -- the cheapest way to silence a false fire, and exactly ` +
      `what this gate exists to make impossible. A HIGHER count means the exemption just widened.`
  );
}
```

### Proving a change to the manifest did not reverse a decision

```bash
cd src/mcp/vice
node --test anno-derivation.test.ts skill-attribution.test.ts
# expect: 53 tests / 0 fail / 1 skipped   (the skip is the live-gated upstream re-hash)

# to run the skipped half too, if a pinned clone is available:
ANNO_UPSTREAM_CLONE=/path/to/clone VICE_REQUIRE_ANNO_UPSTREAM=1 \
  node --test anno-derivation.test.ts
```

Full local gate ladder for a `<verify>` block:

```bash
cd src/mcp/vice && npm run typecheck && npm run test:automated
cd - && node scripts/check-no-analyser.mjs \
      && node scripts/check-skill-description-overlap.mjs \
      && node scripts/check-npm-packages.mjs
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `anno-tools.ts` / `CURATED_ANNO_TOOLS` | `anno-tools.ts` / `CURATED_ANNO_TOOLS` (19 verbs) | Phase 29, plans 29-05/29-10 | **The manifest still names the old pair** — the phase's central edit |
| `anno-derivation.test.ts` | `anno-derivation.test.ts` (renamed 29-05, gained the surface-derivation half in 29-08) | Phase 29 | **Trigger 1's mechanism still names the old file** |
| `anno-session.ts` FIFO mutex | No module of that name; the store is a single writer with per-write optional `base_revision` compare-and-swap | Phases 28-29 | `set_immediate_format`'s justification names a mutex that no longer exists |
| A splitter concept was needed to distinguish adjacent same-type tables | `STORE-02`: ranges are never merged on adjacency — *"designed out by construction rather than worked around"* | v0.7.0 / Phase 28 | `toggle_splitter`'s named blocker is closed; its `DECOMP-01`/`BUILD-02` ids remain live (re-mapped to v0.9.0) |
| Per-edit undo journal as the answer to "an edit can be reverted" | Whole-store snapshot/restore — `revertTo(handle, revision)` at the store layer, no surface verb | `D2`, v0.7.0 | The criterion for `anno_undo`'s omission — and it points at **keeping** the omission |
| `SURF-01`, `SURF-03`, `ANNO-*` requirement families | `STORE-*`, `SEAM-*`, `MCP-*`, `EXPORT-*`, `REPOINT-*`, `CUT-*` | v0.7.0 | Cited ids in the manifest no longer resolve against current `REQUIREMENTS.md` |
| Phase 31 had 4+ success criteria | Phase 31 has **2**, narrowed by `D-01` | 2026-08-30 | Two live citations of "Phase 31 criterion 4" are now stale |
| `test:automated` carried a failure baseline | No baseline; clean floor is **0** | superseded | Plan against 0 failures, not 5/7/44 |

**Deprecated/outdated — do not cite:**
- `anno-tools.ts`, `anno-session.ts`, `anno-derivation.test.ts`, `CURATED_ANNO_TOOLS`: gone.
- `SURF-01`, `SURF-03`, `anno-*`: not in current `REQUIREMENTS.md`.
- "ROADMAP Phase 31 criterion 4": the attribution criterion is now **criterion 1**.
- Phase numbers `20`, `21`, `20/21` in the manifest: superseded roadmap.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The criterion v0.7.0 supplies for `anno_undo` is **`STORE-04`** specifically (rather than, say, `STORE-01` or a bare `D2` reference). `D2` is titled *"undo → whole-store snapshot/restore"* and its last sentence is *"`STORE-04` is scoped to what a planted-violation test can actually prove"*, and `STORE-04` is the only requirement whose text contains *"an edit can be reverted"* — so `STORE-04` is the strongly-indicated id, but no document says "the criterion for `anno_undo` is STORE-04" in those words | Finding 5 | Low. The **direction** (omission stands) is verified from three independent places; only the exact id is inferred. If wrong, the fix is a one-token edit. **Worth a confirmation from the owner or an explicit note in the plan.** |
| A2 | The two `"ROADMAP Phase 31 criterion 4"` citations *should* be corrected in this phase rather than left as dated history. They are live cross-references in a script comment and in STATE.md, and criterion numbering changed under them — but the phase's own criteria do not name them | Findings 8 / Locked Decisions | Low. Discretionary either way. If left, note it explicitly so a later reader knows it was seen and decided, not missed |
| A3 | `SURF-01`/`SURF-03`/`Phase 20-21` should be **dated** rather than re-pointed, because no current requirement is their successor | Finding 4, Pitfall 2 | Low. A judgement call about a historical record; both readings are defensible |
| A4 | The naming-line assertion belongs in `skill-attribution.test.ts` rather than a new file | Standard Stack, Finding 8 | Low. A new `docs-*`-prefixed file would red `audit-integrity.test.ts`; a differently-prefixed new file just costs a CI wiring step |

**Everything else in this document is `[VERIFIED]` against this tree on 2026-08-31**, by
reading the source-of-truth file and/or executing the command shown.

## Open Questions (RESOLVED)

All four are resolved. Each carries a `**RESOLVED:**` line naming the plan and the delta or
decision that adopted it. **The recommendations themselves are unchanged** — every one was
adopted verbatim, so nothing here needed revising, only marking.

1. **Should `STORE-04` be the `requirement_id`, or should `anno_undo` instead get a new field
   recording "criterion arrived, answered otherwise"?**
   - What we know: `requirement_id` is optional, shape-validated only, and its two existing
     uses mean *"the requirement that would supply the criterion for adding this"*. For
     `anno_undo` the criterion **has** arrived and was answered a different way — a slightly
     different semantic than the two siblings.
   - What's unclear: whether overloading `requirement_id` here muddies its meaning.
   - **Recommendation:** use `"requirement_id": "STORE-04"` (no schema risk, matches trigger
     3's language) **and** make the justification carry the distinction in prose: the criterion
     arrived, `D2` answered it with whole-store snapshot/restore, the omission stands. Prose is
     where this manifest already records nuance.
   - **RESOLVED:** adopted verbatim by plan `31-01`, task 1, delta **D3** — `"disposition"` stays
     `omit`, `"requirement_id": "STORE-04"` is added in the siblings' key slot, and the rewritten
     `justification` carries the arrived-and-answered distinction in prose (`STORE-04`,
     `revertTo(handle, revision)`, decision `D2`). No new field was invented. The inference itself
     is carried forward as a flagged assumption in `31-01-PLAN.md` and recorded as judgement 1 of
     the dated `- [Phase 31]:` STATE.md entry in plan `31-03`, task 2.

2. **Does `anno_toggle_splitter`'s justification need correcting now that `STORE-02` closed
   its blocker?**
   - What we know: `STORE-02`'s text explicitly names *"the manifest's named blocker for
     `DECOMP-01` and `BUILD-02`"* and says it is designed out by construction. The manifest
     still predicts a systematic over-merge bias that cannot occur.
   - What's unclear: criterion 2 names only `anno_undo`. Doing more is arguably scope creep;
     doing less leaves a known-false prediction in a record this phase is opening anyway.
   - **Recommendation:** add a one-sentence dated note. Cheap, in the same file, in the same
     commit, and it prevents a future reader acting on a false prediction.
   - **RESOLVED:** adopted verbatim by plan `31-01`, task 1, delta **D7** — one dated sentence
     recording that `STORE-02` closed the blocker **by construction**, in the same file and the
     same single commit, with `requirement_id: DECOMP-01` and `also_required_by: [BUILD-02]` left
     exactly as they are.

3. **Should the naming-line assertion also cover `installer/skills/`, given
   `skill-attribution.test.ts` is scoped to `src/skills` by design?**
   - What we know: criterion 1 says "across two trees". The gate already covers both trees
     with block+hit pins. Adding a second root to this test is a small, explicit widening.
   - **Recommendation:** yes, cover both, and say at the point of use *why* this one test
     departs from the file's `src/skills`-only scope — the criterion is about two trees.
   - **RESOLVED:** adopted verbatim by plan `31-02`, task 1 — `SKILL_ATTRIBUTION_ROOTS` is a
     two-element tuple (`SKILLS_DIR`, then `join(ROOT, "installer", "skills")`) walked by the one
     new test, with the scope departure stated in a comment at the point of use and recorded as a
     `key_links` entry. `SKILLS_DIR` is unchanged and no existing test is re-scoped.

4. **Is a `31-VERIFICATION.md` scoring pass the intended evidence for criterion 1, or does the
   phase need a plan that produces measurements as a deliverable?**
   - What we know: the ROADMAP Note says *"no verification pass has scored the `ABS-02`
     chain's byte-identity across both trees since, and a status may not claim more than its
     evidence."* That points at the verifier, not at a plan.
   - **Recommendation:** have a plan **produce the measurement and the assertion**, and let
     `/gsd-verify-work` score it. A committed assertion is stronger evidence than a
     verification-time grep, and it keeps being true.
   - **RESOLVED:** adopted verbatim as the whole phase's shape — plan `31-02` produces the
     committed assertion plus its planted-violation proof and records the measured counts in its
     SUMMARY, and scoring is left to the Phase 31 verification pass. Plan `31-03`, task 2 records
     the matching non-promotion as judgement 4: `REPOINT-03` and `REPOINT-04` stay `Pending`
     because a status row does not move ahead of the re-verification verdict that scores it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | every test and gate | ✓ | ≥ 22.18 required by `engines`; the suite ran successfully | — |
| npm | `npm run test:automated`, `npm pack --dry-run` | ✓ | ran successfully | — |
| `node_modules` in `src/mcp/vice` | the test suite | ✓ | present (suite ran) | `scripts/ensure-mcp-deps.sh` |
| git | the removal gate's `git ls-files` scope query | ✓ | repo is a git repo | — |
| GNU grep | measurement commands | ✓ | — | reads must use `-a` for `anno-memmap-render.ts` |
| A running VICE broker | **must be ABSENT** | ✓ absent | `systemctl --user is-active vice-broker` → `inactive`; no `x64sc` process | n/a — a live broker reddens BACK-05 |
| ACME cross-assembler | only under `VICE_REQUIRE_ACME=1` (CI) | not probed | — | Local `test:automated` does not set it; `disasm-roundtrip.test.ts` SKIPs |
| `ANNO_UPSTREAM_CLONE` (a pinned upstream clone) | the live-gated re-hash test | ✗ absent | — | The test SKIPs by design; **this is correct** and CI never sets it. Do not make its absence a failure |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the upstream clone (SKIPs by design); ACME (SKIPs
locally, hard-required only in CI).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node --test`), Node ≥ 22.18. No third-party framework |
| Config file | none — `src/mcp/vice/test-gate.mjs` is the file-selection seam; `src/mcp/vice/tsconfig.json` for typecheck |
| Quick run command | `cd src/mcp/vice && node --test skill-attribution.test.ts anno-derivation.test.ts skill-description-overlap.test.ts` (~0.5 s) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (2918 tests, ~47 s, exit 0 on a clean tree) |
| Gate ladder (non-test) | `node scripts/check-no-analyser.mjs`, `check-skill-description-overlap.mjs`, `check-npm-packages.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPOINT-03 | The `ABS-02` chain is intact: 5 blocks / 3 files / 6 fields / digest equality / adaptation statement, over `src/skills` | unit | `node --test skill-attribution.test.ts` | ✅ `src/mcp/vice/skill-attribution.test.ts` |
| REPOINT-03 | **10 instances across two trees, each with its two naming lines byte-identical** | unit | `node --test skill-attribution.test.ts` (new test) | ❌ **Wave 0** — no assertion covers this claim today |
| REPOINT-03 | Deleting an attribution header FAILS rather than silences (both trees, block + hit pins) | integration | `node scripts/check-no-analyser.mjs` | ✅ + `removal-gate.test.ts` |
| REPOINT-03 | The twin tree carries the same headers, proven against the **shipped** copy | integration | `node scripts/check-npm-packages.mjs` | ✅ `scripts/check-npm-packages.mjs` |
| REPOINT-03 | `description:` is substantively rewritten (names the annotation store, not the analyser) | manual-only | — | ⚠️ **Human judgment.** "Substantively rather than worked around" is editorial. Score it by reading the text plus 29-09's record; no test can assert substance |
| REPOINT-03 | `ABS-03`'s pairwise trigger-collision check passes over all seven descriptions | integration | `node scripts/check-skill-description-overlap.mjs` | ✅ + `skill-description-overlap.test.ts` (incl. its live-execution control) |
| REPOINT-03 | CLAUDE.md's project-skills table stays byte-identical to every `description:` | integration | same command (failure mode #7) | ✅ |
| REPOINT-04 | The manifest's schema survives the edit (pin shape, 5 procedures, known dispositions, licence, triggers with mechanisms) | unit | `node --test anno-derivation.test.ts` | ✅ `src/mcp/vice/anno-derivation.test.ts` |
| REPOINT-04 | Every non-curated call still carries a justification **and** a citation naming a file line | unit | same | ✅ (`:144-222`) |
| REPOINT-04 | `anno_undo`'s `requirement_id` is a well-formed requirement id | unit | same | ✅ (`:207-213`) — optional field, shape-gated |
| REPOINT-04 | The omission is **not reversed**: `omit` verbs absent under any spelling; manifest ↔ surface agree in both directions | unit | same (`derivationVerdict`, `:405-425`, `:451-478`) | ✅ |
| REPOINT-04 | The manifest ↔ attribution-header agreement survives the edit (procedure count, path set, digests) | unit | `node --test skill-attribution.test.ts` (`:419-459`, `:475-507`) | ✅ |
| REPOINT-04 | The manifest is edited **in the same commit** as what it describes | manual-only | `git show --stat <sha>` | ⚠️ **No mechanical enforcement exists.** See Finding 6. Score by inspecting the commit |
| REPOINT-04 | No manifest prose names a deleted module or symbol | manual-only | `grep -n "anno-tools\|anno-session\|anno-upstream-audit\|CURATED_ANNO_TOOLS" <manifest>` → 0 | ❌ **Wave 0 (optional)** — could become an assertion; currently a plan-level grep criterion |

### Sampling Rate

- **Per task commit:** `cd src/mcp/vice && node --test skill-attribution.test.ts anno-derivation.test.ts skill-description-overlap.test.ts` **plus** `node scripts/check-no-analyser.mjs`
- **Per wave merge:** `cd src/mcp/vice && npm run typecheck && npm run test:automated`, then the full gate ladder (`check-no-analyser`, `check-skill-description-overlap`, `check-skill-tool-coverage`, `check-skill-fork-honesty`, `check-skill-cli-invocations`, `check-npm-packages`)
- **Phase gate:** full suite green (0 failures — the clean floor is 0, no baseline) with **no VICE broker running**, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] **`src/mcp/vice/skill-attribution.test.ts`** — a new test scoring `REPOINT-03`'s "10 instances across two trees, each with its two naming lines byte-identical". Must: walk **both** `src/skills` and `installer/skills`; pin the two naming lines as named constants; assert **relations plus a floor** (`src === installer`, `adapted === repository`, `>= 5` per tree), never a growing literal; carry an **in-memory** planted violation proving the predicate bites; **not** assert adjacency of the two lines.
- [ ] *(optional)* A grep-shaped assertion — or a plan-level acceptance criterion — that the manifest names no deleted module or symbol. The manifest currently has **no mechanical reader for its prose**; making it a plan criterion is the minimum, making it an assertion is better.
- [ ] Framework install: **none needed.**

*Nothing else is missing: every other clause of both requirements is already covered by an existing, currently-green instrument.*

## Security Domain

`workflow.security_enforcement` is `true` and `security_asvs_level` is `1`
[VERIFIED: .planning/config.json], so this section is required.

**Threat surface of this phase: essentially nil.** No runtime code path changes, no new
dependency, no network call, no user input, no credential, no file written outside the
repository. The deliverables are a JSON planning artifact, a test file, and Markdown records.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Nothing authenticates |
| V3 Session Management | no | No session |
| V4 Access Control | no | No principals |
| V5 Input Validation | **partially — and already enforced** | The only parsed input is `upstream-procedure-manifest.json`, and `anno-derivation.test.ts` is its validator: 40-lowercase-hex commit, 64-hex digests, positive-integer byte counts, `KNOWN_DISPOSITIONS` closed union with an unknown value failing **outright**, `requirement_id` shape-gated, `upstream_citation` required to match `/:\d+/`. Do not weaken any of these to make an edit fit |
| V6 Cryptography | **yes, in the "never hand-roll and never weaken" sense** | `node:crypto` `createHash("sha256")` only, used as an integrity pin: five per-procedure digests, and the upstream MIT notice at `e2579ce7…` / 1072 bytes. Never re-compute a pin to make a check pass; never loosen the commit regex back to `/^[0-9a-f]{7,40}$/` — *"Plan 19-01 demonstrated the abbreviation failure deliberately … that demonstration is the whole point of the tightened pattern"* [VERIFIED: anno-derivation.test.ts:35-38] |
| V12 Files & Resources | **yes, weakly** | Skill content is treated as **untrusted first-party prose**: *"read as a string and matched, never executed"*. A new test must not `import()`, `require()`, `eval()` or spawn anything under `src/skills/` |
| V14 Configuration | **yes, weakly** | `ANNO_UPSTREAM_CLONE` and `VICE_REQUIRE_ANNO_UPSTREAM` must keep their **exact** spellings — renaming one silently converts a hard-gated check into a skipped one in whatever CI binds the old name |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A licence/attribution obligation silently dropped from a **shipped** tarball | Repudiation | `skill-attribution.test.ts` (presence, six fields, digest equality) + the removal gate's bidirectional block+hit pins in **both** trees + `check-npm-packages.mjs` against the shipped file list |
| An integrity pin quietly re-computed so a drifted source "matches" | Tampering | Pins are committed constants compared by string equality; the live re-hash is env-gated and hard-fails under `VICE_REQUIRE_ANNO_UPSTREAM=1` rather than silently passing |
| A missing oracle read as agreement (silent pass) | Tampering / Repudiation | The `D-11` pattern: absence SKIPs loudly with a message naming the env var, and an opt-in switch turns absence into a FAILURE. *"Do not let an ABSENT upstream clone read as agreement"* |
| A gate weakened to silence a false fire (exemption widening) | Tampering | Every exemption is path- or block-scoped with an **exact** hit count; *"A count that has grown is the shape of 'an exemption used to hide a reintroduction' and fails the gate"* |
| Untrusted prose executed by a checker | Elevation of Privilege | Read-and-match only; planted violations live in memory or in `.txt`-suffixed fixtures no runner loads |
| A record answering one question two different ways | Repudiation | `audit-integrity.test.ts` / `docs-review-disposition.test.ts`; and this phase's own lesson — the manifest and the surface must agree, in both directions |

**No new mitigations are required by this phase.** The obligation is **not to weaken** any of
the above while editing the records they protect.

## Sources

### Primary (HIGH confidence — files opened with `Read` this session, and commands executed)

- `src/mcp/vice/skill-attribution.test.ts` (full, 747 lines) — the `ABS-02` registry, the six fields, the notices guard
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json` (full, 67 lines) — schema, three re-sync triggers, five disposition rationales, five procedures
- `src/mcp/vice/anno-derivation.test.ts` (lines 1-260, 276-478) — both halves: upstream integrity and surface derivation
- `scripts/check-no-analyser.mjs` (lines 1-160, 320-560, 965-1014) — scope predicate, pins, exemption classes
- `.planning/REQUIREMENTS.md` (lines 36-65, 112-125, 174-203) — `D1`/`D2`/`D3`, the `REPOINT-*` family, Future/Out-of-Scope
- `src/mcp/vice/anno-store.ts` (lines 2440-2464) — `revertTo`'s signature and revision-argument gate
- Executed: `npm run test:automated` (2918 tests / 0 fail / exit 0); `npm run typecheck`; `node --test` over the three relevant files (53 / 0 fail / 1 skip); all seven CI gate scripts (all exit 0); `node -e` against the live `anno-tools.ts` (19 verbs, no undo/revert under any spelling); `gsd-tools query init.phase-op 31`
- Measured: `grep -ro`, `grep -rx`, `grep -rc`, `diff -q`, `diff -rq`, `git status --porcelain`, `pgrep`, `systemctl --user is-active`

### Secondary (MEDIUM confidence — read via `sed`/`grep` with line numbers cited)

- `.planning/ROADMAP.md` (Phase 31 section + Notes, `:719-734`; progress row `:1151`)
- `.planning/phases/29-the-mcp-surface/29-09-SUMMARY.md` (frontmatter, coverage D1-D8, Decisions, Deviations)
- `.planning/STATE.md` (frontmatter, `:710-724`, `:718`)
- `.planning/PROJECT.md` (`:140-141` — the withdrawal note)
- `scripts/check-skill-description-overlap.mjs` (header, `:76-118`), `scripts/lib/skill-descriptions.mjs` (`:64-118`, `:433-437`)
- `src/mcp/vice/test-gate.mjs` (`:90-133`), `src/mcp/vice/package.json` (`:112-115`)
- `src/mcp/vice/docs-dangling-refs.test.ts`, `docs-linerefs.test.ts`, `removal-gate.test.ts`, `audit-integrity.test.ts`, `docs-review-disposition.test.ts`, `comment-phase-pointers.test.ts` (headers + numeric assertions)
- `.github/workflows/ci.yml` (`:110-215`), `.planning/config.json`, `./CLAUDE.md`

### Tertiary (LOW confidence)

- None. **No web search and no external documentation lookup was performed or needed** — every
  question this phase raises is answerable from this repository, and every answer above was
  measured here today. No package registry was consulted because no package is involved.

## Metadata

**Confidence breakdown:**

- **Standard stack: HIGH** — zero new dependencies; every tool is a Node built-in or a
  first-party file, each verified present and each executed successfully this session.
- **Architecture: HIGH** — every seam, scope predicate, exemption class and pin was read in
  its source file with line numbers cited and quoted verbatim; the two scope exclusions that
  explain the drift were read in the files that declare them.
- **Pitfalls: HIGH** — pitfalls 1, 3, 4, 5 and 6 are each derived from a measured property of
  this tree (the `D2`/`STORE-04` direction; the non-adjacent block at `c64-program-recon:571`
  vs `:577`; the manifest-relation comment forbidding a literal 5; the `.planning/` exclusions;
  `resync_triggers`' length-only assertion). Pitfalls 2 and 7 are derived from this project's
  recorded conventions and prior incidents.
- **What is left to do: HIGH** — criterion 1 was measured true, criterion 2's drift was
  enumerated line by line, and every status record needing a move was located by line number.
- **The `anno_undo` criterion's exact requirement id: MEDIUM** — see assumption A1. The
  *direction* of the decision is HIGH (three independent sources); only the id is inferred.

**Research date:** 2026-08-31
**Valid until:** 2026-09-14 (14 days). Short, and deliberately so: this document pins line
numbers in `upstream-procedure-manifest.json`, `check-no-analyser.mjs` and
`.planning/REQUIREMENTS.md`, and any commit touching those files drifts them. Treat a line-number
mismatch as **drift to re-verify**, never as evidence the finding itself changed — the same
convention CLAUDE.md's Architecture bullet states for its own citations.
