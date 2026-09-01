# Phase 32 — the root-override inventory (D-07's split, MEASURED)

**What this document is.** Research §2.1 measured which repo-level scripts accept a
`--root <dir>` and recorded the answer as **1 / 7**, but its per-script *cheapness*
assessment was explicitly marked `[ASSUMED] — reasoning from the code shape, not from an
attempted edit`. Plan 32-02 attempted the edits. This file records what actually happened,
per script, so plan 32-06 chooses each row's plant descriptor from a measurement instead of
a guess.

**Measured on:** 2026-08-31, from the worktree
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a33dbfd2d3e702cb4`
(branch `worktree-agent-a33dbfd2d3e702cb4`, base `2eaa136`). Every command below was
re-anchored to that worktree root, not to the orchestrator's checkout.

---

## 1. The ordering fact this plan exists to establish

**Every `--root` addition to a guard this phase audits landed in this plan's two commits,
and no plan measures any of those guards before wave 4.**

| Commit | Contents |
|---|---|
| `bdb8379` | `feat(32-02)`: `--root` on `scripts/generate-tool-support-table.mjs` |
| `029e5ca` | `feat(32-02)`: `--root` on the four skill-facing guards |

Both are wave-2 commits. `32-02` is the only plan in the phase whose `files_modified` names
any of those five scripts; the sweep plans that *measure* audited guards are wave 4 and
later (`32-06` onward), and they add no `--root` of their own. D-07 forbids the auditor
modifying the audited guard in the same change that measures it. This is the record that it
did not: the modification and the measurement are separated by a **wave boundary**, not by
prose.

**How a later reader checks it.** From the merged history:

```bash
git log --oneline --all -- scripts/generate-tool-support-table.mjs \
    scripts/check-skill-tool-coverage.mjs scripts/check-skill-fork-honesty.mjs \
    scripts/check-skill-description-overlap.mjs scripts/check-skill-cli-invocations.mjs
```

Every phase-32 commit touching those five paths must be one of the two shas above. A third
one means an `--root` addition leaked into a measuring wave, and the measurement it sits
beside is void.

---

## 2. The split, per script

Route values are exactly two: `--root` (point the guard at a synthetic tree) or `worktree`
(mutate the real working tree under the harness's restore-on-exit).

| Script | In audited set | `--root` BEFORE | `--root` AFTER | Plant route | Measured reason |
|---|---|---|---|---|---|
| `scripts/audit-gate.mjs` | set A | **yes** | yes (untouched) | `--root` | Already had it: `parseArgs()` at `:1118`, `resolve(rootArg ?? join(HERE, ".."))` at `:1143` (and a second at `:993` inside `hookMain()`). Not modified by this plan. |
| `scripts/generate-tool-support-table.mjs` | set A | no | **yes** | `--root` | Cheap and self-contained. All four path constants (`ROOT`/`VICE_DIR`/the three `DEFAULT_*_PATH`/`OUTPUT_PATH`) sat in one contiguous block at `:43-50`; collapsed into `paths(root)`. The pure exported `generateToolSupportTable()` already took every input path as an option, so the CLI was the only site needing the root. |
| `scripts/check-skill-tool-coverage.mjs` | set A | no | **yes** | `--root` | Cheap and self-contained. `ROOT`/`VICE_DIR`/`SKILLS_DIR` were one block at `:55-57`; the five fixed-path reads (`tools-manifest.json`, `tools-manifest.stock.json`, `vice-proxy.ts`, `vice.ts`, `anno-cli.ts`) all derive from `VICE_DIR`. No side-effecting call consumes a path at module load. |
| `scripts/check-skill-fork-honesty.mjs` | set A | no | **yes** | `--root` | Cheap and self-contained. `ROOT`/`VICE_DIR`/`SKILLS_DIR`/`README_PATH`/`PARITY_DOC_PATH` were one block at `:74-78`. One outlier, `ACME_BUILD_SKILL_PATH` at `:533`, was derived from `SKILLS_DIR` and moved into `paths()` with the rest. (`VICE_DIR` is declared and never used — left as-is, out of scope.) |
| `scripts/check-skill-description-overlap.mjs` | **no** (its audited-set member is the lib it drives, `scripts/lib/skill-descriptions.mjs`, set A) | no | **yes** | `--root` | Cheap, but NOT self-contained until fixed: `CLAUDE_MD` was declared at `:179`, ~100 lines from the `:72-73` block. Moved into `paths()`. See §4. |
| `scripts/check-skill-cli-invocations.mjs` | **no** (its audited-set member is the lib it drives, `scripts/lib/anno-cli-invocations.mjs`, set B) | no | **yes** | `--root` **with a fixture requirement** | Cheap, with one real complication: the `execFileSync` of `installer/scripts/sync-skills.mjs` with `cwd: ROOT` at `:71`. See §3. |
| `scripts/check-no-analyser.mjs` | set B | no | **no — deliberately** | `worktree` | Two named side effects make a synthetic root require a *git repository with a working npm package*. See §5. |
| `scripts/check-npm-packages.mjs` | set A | no | **no — not attempted** | `worktree` | Same class of blocker: `packFiles()` at `:147-148` runs `execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: dir })`, called with `join(ROOT, "src/mcp/vice")` at `:175` and `join(ROOT, "installer")` at `:326`. A synthetic root would have to carry two installable npm packages, one of which runs a `prepack` hook (`installer/package.json:52`). |

**Count: 6 of the 8 repo-level scripts now accept `--root`, up from 1.** Two are recorded as
`worktree` routes, both for the same measured reason — a subprocess that treats the root as a
git/npm workspace, not as a directory of text to read.

### 2.1 Why the two non-audited scripts get rows

`scripts/lib/anno-cli-invocations.mjs` (set B) and `scripts/lib/skill-descriptions.mjs`,
`scripts/lib/skill-honesty-checks.mjs`, `scripts/lib/skill-corpus.d.mts`,
`scripts/lib/skill-descriptions.d.mts` (set A) are **libraries with no CLI of their own**.
The guard that can be observed failing on their behalf IS one of these check scripts:

| Audited-set lib member | Gate that measures it |
|---|---|
| `scripts/lib/anno-cli-invocations.mjs` | `check-skill-cli-invocations.mjs:57` imports it |
| `scripts/lib/skill-descriptions.mjs` (+ `.d.mts`) | `check-skill-description-overlap.mjs:70` imports it |
| `scripts/lib/skill-honesty-checks.mjs` | `check-skill-fork-honesty.mjs:71` imports it |
| `scripts/lib/skill-corpus.d.mts` | declaration for `skill-corpus.mjs`, imported by all four skill guards |
| `scripts/lib/anno-cli-verbs.mjs` / `.d.mts` (renamed successors) | `check-skill-tool-coverage.mjs:52` imports `anno-cli-verbs.mjs` |

So a route is needed for eight scripts, not six, and that is why both non-audited check
scripts received `--root` in this plan.

---

## 3. `check-skill-cli-invocations.mjs` — the choice made, and its consequence

The plan offered two ways to handle the `installer/scripts/sync-skills.mjs` child process
under a synthetic root. **The choice implemented is: skip the sync when the resolved root is
not `DEFAULT_ROOT`, and say so in the run's output.**

Reason: T-32-08. `installer/scripts/sync-skills.mjs` inside an operator-supplied tree is not
first-party code. Requiring the fixture to *carry* that script would mean this gate executes
a script from a caller-chosen directory — the exact elevation the threat register disposes as
`mitigate`. Skipping is the mitigation that holds.

Observed, against a synthetic tree inside the worktree:

```
check-skill-cli-invocations: SKIPPED the installer/skills/ regeneration -- --root is
<root>/.tmp-32-02-synth, not this repository, and installer/scripts/sync-skills.mjs is only
run as first-party code. The --root tree must carry both skill trees itself; the scan below
reads them as they are on disk.
check-skill-cli-invocations: OK -- 18 documented anno CLI invocation(s) extracted from 20 of
60 skill file(s) across 2 trees (src/skills, installer/skills); ...
```

The notice goes to **stderr and only on the skip path**, so an unflagged run's stdout report
is byte-identical to its pre-flag self.

**Consequence plan 32-06 must obey.** Because nothing regenerates the shipped tree for a
synthetic root, a `--root` fixture for this gate **must carry both `src/skills/` and
`installer/skills/`**. A fixture with only `src/skills/` fails this gate's own non-vacuity
floor (`no skill files found under installer/skills`) — which means **the green control can
never be green**, and D-04 records the row UNMEASURABLE rather than as evidence. Copying both
trees is a two-line `cp -r`; it is a fixture requirement, not a blocker.

---

## 4. `check-skill-description-overlap.mjs` — the split-root read, and the proof it is closed

`CLAUDE_MD` was declared at `:179`, immediately above check 7 (the verbatim-copy comparison),
about 100 lines below the `ROOT`/`SKILLS_DIR` block at `:72-73`. Under a naive `--root` that
threaded only `SKILLS_DIR`, this gate would have compared the **real repository's**
`CLAUDE.md` project-skills table against the **synthetic tree's** `src/skills/` — a split-root
read in which a planted table disagreement is silently unobservable, because the planted
table is never the one read. It is now inside `paths()`.

**Proved, not asserted.** A disagreement was planted in the SYNTHETIC tree's `CLAUDE.md`
only (`| acme-build | PLANTED DISAGREEMENT. Assemble …`), and the gate was observed going red
against it:

```
$ node scripts/check-skill-description-overlap.mjs --root .tmp-32-02-synth
check-skill-description-overlap: FAIL
  - CLAUDE.md project-skills table disagrees with src/skills/ for "acme-build" (text-differs):
      SKILL.md:  "Assemble Commodore 64 6510 assembly with the ACME cross assembler. ..."
      CLAUDE.md: "PLANTED DISAGREEMENT. Assemble Commodore 64 6510 assembly with the ACME ..."
exit=1
```

The real repository's `CLAUDE.md` was untouched throughout (`git status --porcelain` clean of
it), and the same command was green before the plant. That red is only possible if `CLAUDE.md`
resolved from the synthetic root — which is the assertion.

This is *not* offered as the row's D-04 evidence (that belongs to plan 32-06 and must be
produced through the committed harness, with its own recorded green control). It is recorded
here as the measurement that justifies the `--root` route for this row.

---

## 5. `scripts/check-no-analyser.mjs` — a deliberate `worktree` route

**Not given `--root`, on purpose.** `ROOT` at `:120` is consumed by two functions whose
side effects treat the root as a workspace rather than a directory of text:

1. **`trackedFiles()` at `:192-199`** shells `execFileSync("git", ["ls-files", "-z"], { cwd: ROOT })`.
   A synthetic root would have to be a git repository with the whole corpus staged; an
   un-initialised directory makes `git` fail and the run reports "the pinned commit is not
   present", pointing a reader at CI's checkout depth instead of at their own root.
2. **`shippedInstallerFiles()` at `:201-203`** calls
   `packFiles(join(ROOT, "installer"))` (imported at `:118` from `check-npm-packages.mjs`),
   which runs `npm pack --dry-run --json` and therefore the installer's `prepack` hook
   (`installer/package.json:52` → `node scripts/sync-skills.mjs`).

So a synthetic root for this gate is not a directory — it is a git repository containing a
working npm package that regenerates a skill tree on pack. Research §2.1's recommendation
("cheap in principle, expensive in practice — recommend working-tree mutation") reproduces
exactly.

**Plant route: guarded working-tree mutation with restore-on-exit**, using the harness
delivered by plan 32-01 (`scripts/audit-mutation-harness.mjs`), whose byte-preserving
plant/revert is registered on `finally`, `exit`, `SIGINT`, `SIGTERM` and
`uncaughtException`.

This file is also plan 32-03's declared scope; it was READ for this inventory and not
modified.

---

## 6. What a `--root` synthetic tree must contain, per gate (measured)

Each `--root` script now asserts its own required inputs up front and reports a missing one
as a **TYPO or incomplete synthetic tree**, distinct from a containment refusal. This is the
fixture manifest plan 32-06 needs, taken from the `paths().required` arrays as committed:

| Gate | Required inside the synthetic root |
|---|---|
| `generate-tool-support-table.mjs` | `docs/` (the write target's parent), `src/mcp/vice/{tools-manifest.json, tools-manifest.stock.json, vice-proxy.ts}` |
| `check-skill-tool-coverage.mjs` | `src/skills/`, `src/mcp/vice/{tools-manifest.json, tools-manifest.stock.json, vice-proxy.ts, vice.ts, anno-cli.ts}` |
| `check-skill-fork-honesty.mjs` | `src/skills/`, `README.md`, `docs/stock-vice-parity.md`, `src/skills/acme-build/SKILL.md` |
| `check-skill-description-overlap.mjs` | `src/skills/` (+ `CLAUDE.md` if check 7 is to run rather than SKIP — it is live-gated by design) |
| `check-skill-cli-invocations.mjs` | `src/skills/` **and** `installer/skills/` (see §3) |

Note what is NOT in that list: `capability-registry.ts`, `anno-tools.ts`, `anno-cli.ts`'s
`VERB_OPTIONS`, `vice.ts`'s `DENY_LIST`. Those cross the boundary as **static ESM imports of
the real repository's source**, not as `--root`-relative reads, and that is deliberate — they
are the single-source-of-truth code these gates check *against*, not the corpus they check.
A plant that needs one of them altered is a `worktree` plant, not a `--root` one.

### 6.1 A containment consequence the plans' own verify commands get wrong

`resolveContainedRoot()` (plan 32-01) **refuses any root outside the repository root**, by
design, at a path-segment boundary. Measured:

```
$ node scripts/check-skill-tool-coverage.mjs --root /tmp
check-skill-tool-coverage: REFUSED -- --root "/tmp" resolves to /tmp, which is OUTSIDE the
repository root <worktree>. Refusing: this flag decides which tree the audit reads and
writes, ...
exit=1
```

So **a `--root` synthetic tree must live INSIDE the repository** (a scratch directory under
the repo root, removed after the run). Several `<verification><automated>` blocks in this
phase's plans build their synthetic tree with `mktemp -d`, which lands in `/tmp` and is
therefore refused. Those commands still *pass*, because they assert only that
`docs/tool-support.md` is unchanged and a refusal changes nothing — but they prove containment
rather than containment-plus-redirection. The measurement recorded above used an in-repo
scratch tree and observed the table actually written to
`<root>/.tmp-32-02-synth/docs/tool-support.md`, byte-identical to the real one, with the real
one untouched.

---

## 7. Plant-fixture constraints carried forward to plan 32-06

Both are exact pins in `scripts/check-no-analyser.mjs`, enforced with `===` at
`:962` (`total === cls.prefixHits`). Tripping either reds the removal gate on the commit that
adds the fixture.

1. **The `planted-` prefix pin.** The `planted-fixtures` exemption class at `:539-545` carries
   `prefixes: ["src/mcp/vice/fixtures/planted-"]` and `prefixHits: 2`. Six `planted-*`
   fixtures are committed today and exactly two occurrences of the subject literal sit under
   that prefix. **A NEW fixture under `src/mcp/vice/fixtures/planted-` that carries the
   subject literal changes that total and reds the gate.** So a new plant fixture either
   carries the literal **zero** times, or `prefixHits` moves in the **same commit** that adds
   it.

2. **The `fixtures/README.md` pin.** The `gate-self` exemption class at `:367-378` carries
   `"src/mcp/vice/fixtures/README.md": 1` — the README names the subject exactly once, as part
   of this gate's own file name. **A new index row in that README naming the subject moves
   that pin too**, in the same commit.

---

## 8. Argument-free behaviour: unchanged, measured

Every one of the five modified scripts was run with no arguments before and after the edit,
outputs captured and diffed:

| Script | Exit before | Exit after | Output |
|---|---|---|---|
| `generate-tool-support-table.mjs` | 0 | 0 | byte-identical (`generate-tool-support-table: wrote docs/tool-support.md`); `git diff --exit-code -- docs/tool-support.md` → 0 |
| `check-skill-tool-coverage.mjs` | 0 | 0 | report line identical (baseline run additionally carried a one-time `vice-mcp-selector: deployed host launcher scripts …` banner and a differing PID in Node's SQLite `ExperimentalWarning`; neither is this script's output) |
| `check-skill-fork-honesty.mjs` | 0 | 0 | byte-identical |
| `check-skill-description-overlap.mjs` | 0 | 0 | byte-identical |
| `check-skill-cli-invocations.mjs` | 0 | 0 | identical apart from the PID in Node's `ExperimentalWarning` |

`node scripts/check-no-analyser.mjs` → exit 0. `node scripts/audit-gate.mjs --json` →
`allowed: true`, `redGuards: []`, `structuralErrors: []`. `npm run typecheck` → exit 0.
`grep -ac 'the external analyser' scripts/check-skill-fork-honesty.mjs` → 2, unchanged (`:19` and
`:408`), so no exact-count exemption moved.

`grep -Ec 'process\.env\.[A-Z_]*ROOT|WAIVER|--skip|--force'` → **0 for all five**. No
relaxation hatch was added alongside the flag (D-12-14): `--root` is the only new surface.
