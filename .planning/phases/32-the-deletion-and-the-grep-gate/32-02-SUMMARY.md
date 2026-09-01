---
phase: 32-the-deletion-and-the-grep-gate
plan: 02
subsystem: testing
tags: [ci-guards, audit, mutation-testing, path-containment, cli-flags, node-test]

requires:
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "scripts/lib/audit-root.mjs's resolveContainedRoot() (plan 32-01) — the segment-boundary --root containment refusal every addition here resolves through"
provides:
  - "--root <dir> on scripts/generate-tool-support-table.mjs, with the WRITE target derived from the resolved root so a synthetic-tree run provably cannot clobber docs/tool-support.md"
  - "--root <dir> on all four skill-facing guards (tool-coverage, fork-honesty, description-overlap, cli-invocations), each reading every path from the one root"
  - "the split-root read in check-skill-description-overlap.mjs closed — CLAUDE_MD moved from :179 into paths() — proved by observing the gate red on a plant in a synthetic tree's CLAUDE.md"
  - "the T-32-08 mitigation in check-skill-cli-invocations.mjs: sync-skills.mjs runs only when the resolved root IS this repository, skipped with a visible notice otherwise"
  - "D-07's root-override split recorded as a MEASUREMENT with per-script code-shape reasons, the per-gate synthetic-fixture manifest, and the wave-boundary ordering fact naming its own commits"
affects: [32-06, 32-07, 32-08, 32-09]

actuals:
  tokens: 11745
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "paths(root) as the ONE place a guard's derived paths are built, returning the paths plus a `required` array of the subset that must exist — so a --root fixture's manifest is readable off the source"
    - "Three-layer --root diagnosis: REFUSED (out-of-repo, from resolveContainedRoot) / FAIL (--root) (in-repo but nonexistent or incomplete tree) / the gate's own report — same exit code, separated by message (WR-03)"
    - "A first-party child process is gated on `resolvedRoot === DEFAULT_ROOT` and skipped with a stderr notice under --root, never executed against an operator-supplied tree (T-32-08)"
    - "Byte-identity of the unflagged invocation as an acceptance criterion, measured by capturing stdout+stderr before and after and diffing — the --root addition changed testability and nothing else"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-root-override-inventory.md
  modified:
    - scripts/generate-tool-support-table.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-fork-honesty.mjs
    - scripts/check-skill-description-overlap.mjs
    - scripts/check-skill-cli-invocations.mjs

key-decisions:
  - "All four skill-facing guards received --root; NONE fell back to working-tree mutation. D-07's cheapness test was CONFIRMED per script rather than assumed: each resolves every path from one contiguous module-scope block anchored on a single ROOT, and no path constant is consumed at module load by a side-effecting call."
  - "check-skill-cli-invocations.mjs SKIPS the installer/skills regeneration under a non-default root rather than requiring the fixture to carry sync-skills.mjs. Executing a script out of an operator-supplied tree is the exact elevation T-32-08 disposes as `mitigate`; the cost is a stated fixture requirement (the --root tree must carry both skill trees), which is a two-line cp -r."
  - "paths() returns a `required` array and the gate asserts those paths exist up front. Without it a mistyped or incomplete --root surfaces either as an uncaught ENOENT or — worse — as one of the gate's OWN non-vacuity failures pointing at the corpus, which reads as a real finding."
  - "generate-tool-support-table.mjs's success message keeps its pre-flag bytes for the unflagged run (relative() yields exactly `docs/tool-support.md`) and appends `under --root <path>` only when a root was supplied. Byte-identity was an acceptance criterion; an operator seeing which tree was written is a safety requirement; the conditional satisfies both."
  - "The two-catch shape (REFUSED around resolveContainedRoot, then ONE try/catch around the calls that can throw on a bad root) follows the pattern plan 32-01 established in check-guard-fates.mjs:854-893 rather than collapsing to a single catch. A refusal and a typo then carry distinct prefixes as well as distinct messages."
  - "A --root synthetic tree must live INSIDE the repository, because resolveContainedRoot refuses anything outside it. Several of this phase's plans build their synthetic tree with mktemp -d, which lands in /tmp and is refused; the measurement here used an in-repo scratch tree instead. Recorded in the inventory §6.1 so 32-06 does not inherit the mistake."

patterns-established:
  - "The synthetic-fixture manifest is DERIVED from source, not documented separately: paths().required is the list, and the inventory's §6 table is a transcription of it."
  - "Prove a path-threading fix by planting in the synthetic tree and observing the red — a fix that only 'looks threaded' is exactly the false green this phase exists to rule out."

requirements-completed: [CUT-04]

coverage:
  - id: D1
    description: "The table generator can be pointed at a synthetic tree and provably cannot clobber the repository's docs/tool-support.md; argument-free behaviour is byte-identical"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "node scripts/generate-tool-support-table.mjs --root .tmp-32-02-synth (wrote .tmp-32-02-synth/docs/tool-support.md; git diff --exit-code -- docs/tool-support.md exited 0; cmp showed the synthetic table byte-identical to the real one)"
        status: pass
      - kind: integration
        ref: "node scripts/generate-tool-support-table.mjs (stdout+stderr byte-identical to the pre-change capture; git diff --exit-code -- docs/tool-support.md exited 0)"
        status: pass
      - kind: integration
        ref: "node scripts/generate-tool-support-table.mjs --root /tmp (REFUSED, exit 1, names /tmp and the repository root); --root nonexistent-typo (TYPO, exit 1, no ENOENT stack)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-support-table.test.mjs (11 tests, 0 fail — the exported pure function's signature and the committed table's byte-identity both unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "All four skill-facing guards accept a contained --root, read every path from it, and behave byte-identically when invoked with no arguments"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "each of the four run with no arguments, exit 0, output diffed against the pre-change capture (fork-honesty and description-overlap byte-identical; tool-coverage and cli-invocations identical apart from Node's PID-bearing SQLite ExperimentalWarning and a first-run vice-mcp-selector banner)"
        status: pass
      - kind: integration
        ref: "each of the four --root .tmp-32-02-synth (an in-repo synthetic tree) exits 0 — the green control the sweep needs"
        status: pass
      - kind: integration
        ref: "each of the four --root /tmp exits 1 with REFUSED naming /tmp as outside the repository root; --root nonexistent-typo and --root docs exit 1 as TYPO / incomplete-tree"
        status: pass
      - kind: integration
        ref: "grep -n 'join(DEFAULT_ROOT' over all five scripts returns nothing; grep -Ec 'process.env.[A-Z_]*ROOT|WAIVER|--skip|--force' is 0 for all five; grep -c resolveContainedRoot is >=1 for all five"
        status: pass
      - kind: integration
        ref: "grep -ac the external analyser scripts/check-skill-fork-honesty.mjs == 2 (unchanged, :19 and :408) and node scripts/check-no-analyser.mjs exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The CLAUDE_MD split-root read in check-skill-description-overlap.mjs is genuinely closed, not merely relocated"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "planted `| acme-build | PLANTED DISAGREEMENT. ...` into .tmp-32-02-synth/CLAUDE.md ONLY; node scripts/check-skill-description-overlap.mjs --root .tmp-32-02-synth exited 1 reporting the text-differs disagreement, while the same command was green before the plant and the real CLAUDE.md stayed untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-07's split is a measured record with per-script reasons, and plan 32-06's plant-route choice per script has a stated source"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-root-override-inventory.md — 8 rows, every row a route of --root or worktree, every worktree row a named code shape (trackedFiles()'s git ls-files at :192-199, shippedInstallerFiles()/packFiles()'s npm pack --dry-run at :201-203 and :147-148, installer/package.json:52's prepack)"
        status: pass
      - kind: integration
        ref: "node scripts/check-no-analyser.mjs exits 0 with the inventory committed (it lives under .planning/, which the gate excludes by prefix)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The wave-boundary ordering fact: every --root addition to an audited guard landed before any plan measures those guards"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "inventory §1 names bdb8379 and 029e5ca and gives the `git log --oneline --all -- <the five paths>` command a later reader runs; 32-02 is the only plan in the phase whose files_modified names any of the five"
        status: pass
    human_judgment: false

duration: 41 min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 02: Contained `--root` on Five Audited Guards Summary

**Six of eight repo-level guard scripts now accept a repository-contained `--root <dir>` (up from one), the table generator's WRITE target included, so the phase-32 sweep can plant against a synthetic tree without touching `docs/tool-support.md` — and D-07's 1/7 split is now a measurement with per-script code-shape reasons instead of a research assumption.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-08-31T17:52Z (approx.)
- **Completed:** 2026-08-31T18:33Z (approx.)
- **Tasks:** 3
- **Files modified:** 6 (5 modified, 1 created)

## Accomplishments

- **`--root` on `scripts/generate-tool-support-table.mjs`, write target included.** `ROOT`/`VICE_DIR`/`OUTPUT_PATH` and the three `DEFAULT_*_PATH` constants collapsed into one `paths(root)`; the CLI resolves `--root` through `resolveContainedRoot()`. Measured: a `--root` run writes `<root>/docs/tool-support.md` and leaves `git diff --exit-code -- docs/tool-support.md` at 0, while an unflagged run is byte-identical to its pre-change self.
- **`--root` on all four skill-facing guards — none fell back.** D-07's "cheap and self-contained" test was confirmed per script, not assumed. Each got the same shape: `DEFAULT_ROOT`, `paths(root)` (paths + a `required` array), `parseArgs()` in `audit-gate.mjs:1118`'s shape, a `REFUSED` catch around the resolve, and one try/catch that reports a TYPO or an incomplete synthetic tree rather than an ENOENT.
- **The split-root read in `check-skill-description-overlap.mjs` closed and proved.** `CLAUDE_MD` moved from `:179` into `paths()`. Proof: a disagreement planted in a *synthetic* tree's `CLAUDE.md` turned the gate red (`text-differs` for `acme-build`), which is only possible if `CLAUDE.md` resolved from the synthetic root.
- **T-32-08 mitigated in `check-skill-cli-invocations.mjs`.** The `sync-skills.mjs` child process now runs only when the resolved root IS this repository; under `--root` it is skipped with a stderr notice naming which legs ran. The notice is stderr-and-skip-path-only, so the unflagged run's stdout report is unchanged.
- **The root-override inventory (8 rows).** Records the before/after per script, both `worktree` routes with named code shapes, the per-gate synthetic-fixture manifest transcribed from `paths().required`, the two plant-fixture pins 32-06 must obey, and the wave-boundary ordering fact naming its own commits.

## Task Commits

1. **Task 1: Give the table generator a contained `--root`** — `bdb8379` (feat)
2. **Task 2: Give the four skill-facing guards a contained `--root`** — `029e5ca` (feat)
3. **Task 3: The root-override inventory** — `b5d39b2` (docs)

## Files Created/Modified

- `scripts/generate-tool-support-table.mjs` — `paths(root)` now owns every read path and the one write path; `--root` parsed and contained at the CLI; `DEFAULT_PATHS` supplies the exported pure function's option defaults so `tool-support-table.test.mjs` is unaffected.
- `scripts/check-skill-tool-coverage.mjs` — `paths(root)` with `required` covering `src/skills` plus the five fixed `src/mcp/vice/*` reads.
- `scripts/check-skill-fork-honesty.mjs` — `paths(root)` covering `src/skills`, `README.md`, `docs/stock-vice-parity.md` and `acme-build/SKILL.md` (the outlier that sat at `:533`). The pinned literal count is unchanged at 2.
- `scripts/check-skill-description-overlap.mjs` — `paths(root)` now also owns `claudeMd`, closing T-32-09.
- `scripts/check-skill-cli-invocations.mjs` — `paths(root)` owns both skill trees and the sync script path; the sync is root-gated (T-32-08).
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-root-override-inventory.md` — the measured D-07 split, 8 rows, plus §6 fixture manifest, §6.1 containment consequence and §7 fixture pins.

## Decisions Made

See the `key-decisions` frontmatter. The three that most affect later plans:

1. **A `--root` synthetic tree must live INSIDE the repository.** `resolveContainedRoot()` refuses anything outside it, at a segment boundary. Several `<verification><automated>` blocks in this phase's plans build their tree with `mktemp -d` (which lands in `/tmp` and is refused). Those commands still pass — a refusal changes nothing, so the "table untouched" assertion holds — but they prove containment, not containment-plus-redirection. Recorded in the inventory §6.1; plan 32-06 should use an in-repo scratch directory.
2. **`check-skill-cli-invocations.mjs`'s `--root` fixture must carry BOTH skill trees.** Because the sync is skipped, a fixture with only `src/skills/` trips the gate's own `no skill files found under installer/skills` non-vacuity floor — so the *green control* can never be green, and D-04 would record the row UNMEASURABLE.
3. **Two non-audited check scripts got `--root` anyway.** `check-skill-description-overlap.mjs` and `check-skill-cli-invocations.mjs` are not audited-set members, but four audited-set members (`lib/anno-cli-invocations.mjs`, `lib/skill-descriptions.mjs` + its `.d.mts`, `lib/skill-corpus.d.mts`) are **libraries with no CLI of their own** — the guard that can be observed failing on their behalf IS one of those two scripts. Inventory §2.1 gives the mapping.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added an up-front required-inputs assertion to each `--root` script**

- **Found during:** Task 2 (and applied retroactively in Task 1's shape)
- **Issue:** The plan's WR-03 instruction was to "wrap the throwing calls in one try/catch". For these four scripts the throwing calls are the whole straight-line module body, and `walkSkills()` deliberately *swallows* ENOENT (`scripts/lib/skill-corpus.mjs:47-51`). A mistyped or incomplete `--root` would therefore surface not as an ENOENT but as one of the gate's **own non-vacuity failures** ("no skill files found under src/skills — the corpus walk or the tree itself has regressed"), which reads as a real finding about the repository. That is a worse failure than the ENOENT WR-03 exists to prevent: it is a *plausible-looking wrong answer*.
- **Fix:** `paths(root)` returns a `required` array enumerating every path the gate reads at a FIXED location with no existence check of its own, and the one try/catch asserts each is present before any check runs, reporting `FAIL (--root) -- ... This is a TYPO or an incomplete synthetic tree, NOT a containment refusal`.
- **Files modified:** all five scripts
- **Verification:** `--root nonexistent-typo` and `--root docs` (a real directory with no `src/skills`) both exit 1 naming the missing path; `--root .tmp-32-02-synth` (complete tree) exits 0.
- **Committed in:** `bdb8379`, `029e5ca` (part of the task commits)

**2. [Rule 2 - Missing Critical] Guarded the output directory in the table generator**

- **Found during:** Task 1
- **Issue:** `writeFileSync(join(root, "docs/tool-support.md"))` against a `--root` tree with no `docs/` throws a bare ENOENT.
- **Fix:** explicit `existsSync(dirname(outputPath))` check with a message stating that a `--root` tree must carry its own `docs/` and that this script never creates one.
- **Files modified:** `scripts/generate-tool-support-table.mjs`
- **Verification:** the synthetic-tree run wrote to `<root>/docs/tool-support.md` as expected; the message is reachable by pointing `--root` at a tree without `docs/`.
- **Committed in:** `bdb8379`

**3. [Rule 1 - Adjustment] Two-catch shape instead of literally one**

- **Found during:** Task 1
- **Issue:** The plan says "one try/catch". Wave 1's own established pattern (`scripts/check-guard-fates.mjs:854-893`, and `32-01-SUMMARY.md`'s recorded pattern *"a refusal and a typo exit with the same code, so they are separated by their message"*) is a `REFUSED` catch around `resolveContainedRoot()` **plus** one try/catch around the calls that can throw on a bad root.
- **Fix:** followed the repo's established two-stage shape in all five scripts. This is consistent with the plan's own wording — "resolve through `resolveContainedRoot(...)`, **and** wrap the throwing calls in one try/catch" — which separates the resolve from the throwing calls.
- **Files modified:** all five scripts
- **Verification:** `--root /tmp` → `REFUSED --`; `--root nonexistent-typo` → `FAIL (--root) -- ... TYPO`. Distinct prefixes and distinct messages, same exit code.
- **Committed in:** `bdb8379`, `029e5ca`

---

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 adjustment)
**Impact on plan:** All three tighten the diagnosability contract the plan's own WR-03 citation asks for. No scope creep — no new flag, no new file, no relaxation hatch. `grep -Ec 'process\.env\.[A-Z_]*ROOT|WAIVER|--skip|--force'` is 0 for all five scripts.

## Issues Encountered

**The known worktree-only test failure, expected and NOT caused by this plan.** `cd src/mcp/vice && npm run test:automated` exits 1 with **exactly one failure**:

```
not ok 1472 - path agreement (D-3, D-6, THE regression this task exists to catch): ...
  location: 'src/mcp/vice/repo-root.test.ts:178:1'
  stack:    'repo-root.test.ts:249:10'
  error:    'the agreed directory must not sit under .claude -- got
             <worktree>/.vice-supervisor (the exact regression a naive move would introduce)'
```

Tallies: `tests 2941, pass 2934, fail 1, skipped 1, todo 5`. This is the pre-existing artefact recorded in `deferred-items.md` and in this plan's dispatch context: `repo-root.test.ts:248-251` asserts `!supervisorDir().includes(".claude")`, and a GSD worktree root *is* `<repo>/.claude/worktrees/agent-*`. The same suite is 0-fail in the main checkout. Per instruction it was **not** fixed, **not** loosened, and is **not** treated as a regression. Every other suite is green, including `tool-support-table.test.mjs` (11/11) which is the test most exposed to Task 1's edit.

**`npm ci` was needed inside the worktree** before `tsc` and `node --test` would resolve (`src/mcp/vice/node_modules` is gitignored and absent in a fresh worktree). Run from the committed lockfile; nothing new installed.

**Absolute-path re-anchoring.** Every `<verification><automated>` command in `32-02-PLAN.md` hardcodes the orchestrator's checkout (`cd /home/henrik/dev/henrik/git/c64-re-tools && ...`). All were re-anchored to `$(git rev-parse --show-toplevel)` = `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a33dbfd2d3e702cb4`, and all Edit/Write used relative paths. The commands actually run are quoted below.

## Verification Results (re-anchored to the worktree root)

All run from `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a33dbfd2d3e702cb4`.

| Command (as run) | Result |
|---|---|
| `node scripts/generate-tool-support-table.mjs --root .tmp-32-02-synth` (in-repo synthetic tree, `docs/` + the three manifest/proxy inputs) | exit 0; wrote `.tmp-32-02-synth/docs/tool-support.md`, `cmp` byte-identical to the real table |
| `git diff --exit-code -- docs/tool-support.md` (after the `--root` run) | exit 0 — real table untouched |
| `node scripts/generate-tool-support-table.mjs` then `git diff --exit-code -- docs/tool-support.md` | exit 0 / exit 0; stderr byte-identical to the pre-change capture |
| `node scripts/generate-tool-support-table.mjs --root /tmp` | exit 1, `REFUSED`, names `/tmp` and the repository root |
| `node scripts/generate-tool-support-table.mjs --root /nonexistent-typo` | exit 1, `REFUSED` (it is out-of-repo, so containment fires first) |
| `node scripts/generate-tool-support-table.mjs --root nonexistent-typo` | exit 1, `FAILED -- ... This is a TYPO`, no ENOENT stack |
| `node scripts/check-skill-tool-coverage.mjs` / `-fork-honesty` / `-description-overlap` / `-cli-invocations` (no args) | all exit 0, reports unchanged |
| the same four with `--root .tmp-32-02-synth` | all exit 0 — green controls |
| the same four with `--root /tmp` | all exit 1, `REFUSED`, naming `/tmp` |
| `node scripts/check-skill-description-overlap.mjs --root .tmp-32-02-synth` with a planted `CLAUDE.md` disagreement | exit 1, `text-differs` for `acme-build` — the split-root fix proved |
| `node scripts/check-no-analyser.mjs` | exit 0 (before Task 1, after Task 2, and with the inventory committed) |
| `node scripts/check-npm-packages.mjs` | exit 0 — 79 / 34 files, 7 skills |
| `node scripts/audit-gate.mjs --json` | `allowed: true`, `redGuards: []`, `structuralErrors: []` |
| `cd src/mcp/vice && npm run typecheck` | exit 0 |
| `cd src/mcp/vice && npm run test:automated` | exit 1 — `fail 1`, the known `repo-root.test.ts:249` worktree artefact only (see Issues) |
| `cd src/mcp/vice && node --test tool-support-table.test.mjs` | exit 0, 11/11 |
| `node scripts/check-guard-fates.mjs` | exit 1 — the pre-declared incomplete-registry red and nothing else: `setA=43 setB=16 setC=2 total=61 rows=1`, followed by exactly 60 `no recorded fate` lines and no other error class |
| `grep -n 'join(DEFAULT_ROOT'` over all five scripts | no matches |
| `grep -Ec 'process\.env\.[A-Z_]*ROOT\|WAIVER\|--skip\|--force'` over all five | 0 for each |
| `grep -ac 'the external analyser' scripts/check-skill-fork-honesty.mjs` | 2, unchanged (`:19`, `:408`) |
| `git status --porcelain` at close | clean (the synthetic tree was removed with a targeted `rm -rf`; no `git clean`) |

**The fact research §7.4 marked NOT MEASURED, now measured:** `scripts/generate-tool-support-table.mjs` **WRITES** `docs/tool-support.md` on direct invocation — `main()` calls `writeFileSync(outputPath, doc)` unconditionally and there is no `--check` mode. So the close gate's step 4 must stay "run it, then `git diff --exit-code -- docs/tool-support.md`", exactly as §7.4 drafted it.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for plan 32-06 (the sweep).** Every plant route now has a stated source: inventory §2 gives the route per script, §6 gives the exact fixture manifest per `--root` gate (transcribed from `paths().required`), §6.1 warns that the synthetic tree must be in-repo, §3 states the both-skill-trees requirement for `cli-invocations`, and §7 carries the two exact fixture pins that would red the removal gate.
- **Ready for plan 32-08 (the fate registry).** `check-guard-fates.mjs` is still red only on the incomplete registry (60 of 61 rows unfilled), unchanged by this plan.
- **Two `worktree`-route scripts remain**, both blocked on the same shape (a subprocess treating the root as a git/npm workspace): `check-no-analyser.mjs` and `check-npm-packages.mjs`. Neither was touched; `check-no-analyser.mjs` is plan 32-03's declared scope and was read only.
- **Concern for the merge:** the inventory cites its own commit shas (`bdb8379`, `029e5ca`). Those are worktree-branch shas and survive a merge, but not a rebase. If the orchestrator rebases this branch, §1's two shas need updating to the rewritten ones.

## Self-Check: PASSED

- All 6 key files present on disk (`ls -1` over the created/modified list, all resolved).
- All 3 task commits present in `git log --oneline --all`: `bdb8379`, `029e5ca`, `b5d39b2`.
- Every task's `<acceptance_criteria>` re-run and logged in the table above; all pass, with the single documented exception of `test:automated`'s exit status, which fails only on the known worktree-only `repo-root.test.ts:249` assertion.
- Working tree clean at close; `.planning/STATE.md` and `.planning/ROADMAP.md` untouched; `.planning/PROJECT.md`, `.planning/ARCHITECTURE.md` and `scripts/check-no-analyser.mjs` (plan 32-03's scope) untouched.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*
