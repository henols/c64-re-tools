# Phase 12: Audit Integrity Instrument - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers **one mechanical precondition**: recording `status: passed`
in a milestone audit is impossible while any `docs-*.test.ts` guard in
`.claude/mcp/vice/` is red. The precondition is enforced by committed code, not
by a checklist a future audit could skip.

Concretely, three things and nothing more:

1. **One check point** — a committed executable script that answers "is any
   docs guard red right now?" and "does this audit text declare a gated
   status?". This is the file+line criterion 3 cites.
2. **Two enforcement layers** wired to that one script — a committed test in
   the suite (survives a clean checkout, runs in CI on every merge) and a
   committed `PreToolUse` hook (refuses the write at the moment of recording).
3. **Proof it bites and then clears** — a permanent committed test case proving
   refusal against a deliberately-red guard, plus a one-time real-tree red/green
   transcript satisfying criteria 1 and 2.

**Not in this phase:** fixing what any guard currently reports (that is Phase
15's `GATE-02`), adding a fifth guard, changing which command CI runs, or
gating anything other than the milestone audit's status line.

**Starting state, measured 2026-08-21:** all four guards are green —
`docs-linerefs` 3/3, `docs-dangling-refs` 8/8, `docs-deferred-ledger` 4/4,
`docs-review-disposition` 4/4, 0 failures, ~215 ms wall clock for all four.
Note *why* `docs-review-disposition` is green: the v0.3.0 close filed
`2026-08-21-phase-09-review-in-01-in-03-never-dispositioned.md`, and a todo
naming a finding counts as a disposition source. It was genuinely red at
`4f048bb`. Criterion 2's green run is therefore available immediately; criterion
1's red run must be manufactured.

</domain>

<decisions>
## Implementation Decisions

### Enforcement point

- **D-12-01:** The single check point is a committed executable script,
  `scripts/audit-gate.mjs`. Every enforcement layer calls it; the logic exists
  in exactly one place. This is the file criterion 3 cites by line.

- **D-12-02:** **Layer 1 (clean-checkout-proof)** — a committed test in
  `.claude/mcp/vice/` calls `scripts/audit-gate.mjs` and asserts that no
  `*MILESTONE-AUDIT*.md` under `.planning/` declares a gated status while any
  docs guard is red. This layer is what survives a fresh clone with zero setup:
  it runs under `npm test` and `npm run test:automated`, CI runs it on every
  merge to `main`, and every merge to `main` auto-publishes a patch release — so
  there is no path to a release past a red gate.

- **D-12-03:** **Layer 2 (refuses the write itself)** — the same script is
  wired as a Claude Code `PreToolUse` hook that denies any tool call writing a
  gated status into a `*MILESTONE-AUDIT*.md` while a guard is red. This layer is
  what makes criterion 1's wording literally true ("refusing to **record**
  `status: passed`") rather than merely detected after the fact. `PreToolUse`
  runs first in the permission chain and `exit 2` blocks the call regardless of
  permission mode, so it cannot be bypassed from inside the session.

- **D-12-04:** The hook matcher **must cover `Bash` in addition to `Write` and
  `Edit`.** A `cat > file <<EOF` heredoc is the obvious bypass and it is the
  shape this repo's own agents use constantly. Layer 1 is the backstop for
  anything the matcher still misses; do not treat the hook as sufficient alone.

- **D-12-05:** Wiring Layer 2 requires committing `.claude/settings.json`,
  which `.gitignore:55` currently ignores. **Split it rather than un-ignoring
  it wholesale:** commit a `.claude/settings.json` containing *hooks only*, and
  move the existing machine-specific permission allowlist (which holds absolute
  worktree paths from earlier sessions) into `.claude/settings.local.json`,
  which stays ignored via the user's global gitignore. Claude Code merges the
  two, so behaviour is preserved. Amend `.gitignore:51-55`'s comment to record
  the split and *why* — the existing rationale is about machine-specific
  permission content, and this split honours that rationale instead of
  overriding it. Do not commit absolute paths.

- **D-12-06:** Rejected: a committed `scripts/githooks/pre-commit` as the
  primary layer. `core.hooksPath` is per-clone git config and is not committed,
  so a fresh clone has no enforcement until a setup step runs — the same
  clean-checkout hole that made the plain-settings.json route unacceptable. Not
  worth a third layer for the same coverage Layer 1 already gives.

### Guard-set definition

- **D-12-07:** The guard set is **derived from the tree**, not listed: glob
  `docs-*.test.ts` in `.claude/mcp/vice/`. A fifth guard added by a later phase
  is gated automatically, and there is no second list to drift out of sync.
  Direct precedent: plan 11.1-03 replaced `hostpath-consumers.test.ts`'s
  hard-coded 10-name array with a `readdirSync`-derived list *specifically as
  the improvement*.

- **D-12-08:** The glob carries a **floor of `>= 4` plus an assertion that the
  four current names are present**. A derived set that silently matches nothing
  is a vacuous gate that reports green forever — the floor is what makes the
  derivation trustworthy. Same shape as `hostpath-consumers.test.ts`'s `>= 14`
  floor and `docs-review-disposition.test.ts`'s `>= 100` findings floor.

- **D-12-09:** **Name the gate's own test outside the `docs-*` glob** — e.g.
  `audit-integrity.test.ts`, not `docs-audit-integrity.test.ts`. A `docs-`
  prefixed name would make the gate a member of its own guard set and spawn
  itself recursively. This is a hard correctness constraint, not a style
  preference.

- **D-12-10:** The gate **re-runs the guards live in a subprocess** rather than
  reading a recorded result artifact. All four together cost ~215 ms, and a
  recorded artifact is precisely the stale-derived-state failure mode
  `docs-deferred-ledger.test.ts` exists to prevent.

- **D-12-11:** The gate invokes the four guard files **directly**
  (`node --test docs-*.test.ts`), never `npm test` or `npm run test:automated`.
  It must not depend on the seven manual-only suites in
  `test-gate.mjs`'s `MANUAL_ONLY_TESTS`, and must not be reachable into a hang.
  This also keeps Phase 12 independent of the open question of which command CI
  should run (see Deferred).

### Blast radius

- **D-12-12:** The gate refuses **both `status: passed` and `status:
  tech_debt`.** `GATE-01`'s literal wording names `passed`, but both statuses
  route to `/gsd-complete-milestone` and the audit's own output explicitly
  offers "proceed anyway — accept tech debt". Gating only `passed` would build
  an instrument with a one-word bypass. This is deliberately **stricter than
  `GATE-01` says** — record it as a decision in the phase SUMMARY so the
  milestone audit does not read it as scope drift.

- **D-12-13:** **`status: gaps_found` is never gated.** The gate must never
  obstruct recording honest bad news; its only job is to block a *clean* verdict
  over a red guard. An audit must always be able to say "a guard is red".

- **D-12-14:** **No override hatch — the gate is absolute.** No waiver file, no
  env var. The premise of this entire phase is that documented escapes do not
  hold: `4f048bb` closed v0.3.0 with a red guard and nothing stopped it. When a
  guard is genuinely wrong, the legitimate route is to fix or retire that guard
  **in a commit**, which is visible in history — unlike a waiver line or an
  env-var flag, which leave no trace and reproduce the exact failure this phase
  exists to end.

- **D-12-15:** Because there is no hatch, the refusal message is load-bearing.
  It must name (a) which guard is red, (b) its failing assertion text, and (c)
  the two legitimate routes — fix the documents the guard checks, or change/retire
  the guard in a commit. A blocked operator with no hatch and no diagnosis will
  reach for `--no-verify` or delete the hook.

### Proof artifacts

- **D-12-16:** The primary proof is a **permanent committed test case**, not a
  one-time transcript: inside `audit-integrity.test.ts`, build a synthetic tree
  with a deliberately-red guard file plus a synthetic audit declaring
  `status: passed`, and assert the gate refuses. Add its mirror (same synthetic
  audit, all guards green → allowed) for criterion 2. This is the house
  planted-violation standard — `docs-review-disposition.test.ts` carries exactly
  this pair ("planted violation" / "planted false-negative"), as does
  `check-skill-tool-coverage.mjs`. A transcript proves it worked once; a
  committed test case proves it keeps working.

- **D-12-17:** The one-time **real-tree** red/green run that criteria 1 and 2
  ask for is done by **plant-and-revert on the real repo**, house style (11.1-03:
  "proven by adding a real hostpath.ts import and watching it fail").

- **D-12-18:** **Red `docs-linerefs.test.ts` for that run.** It asserts
  CLAUDE.md's cited `vice-proxy.ts:<N>` line numbers, so changing one digit in
  CLAUDE.md reds it deterministically and reverting is a one-character undo with
  zero risk to product code. Do **not** red `docs-review-disposition.test.ts`
  (needs a todo moved out of the tree) or `docs-deferred-ledger.test.ts` (needs
  `STATE.md` edited, which several other things derive from).

- **D-12-19:** Both transcripts live as a **phase artifact** in
  `.planning/phases/12-audit-integrity-instrument/`, following
  `08.1-WALKTHROUGH-EVIDENCE.md`. `docs/` is reserved in this repo for durable
  cross-milestone findings (`phase0-binmon-findings.md`,
  `phase9-regenerator2000-probe-findings.md`); a gate proof is phase evidence,
  not a standing finding.

- **D-12-20:** The transcript must record the **revert** as explicitly as the
  plant — verified green again afterwards, with the guard's own output shown. A
  plant-and-revert proof that does not show the revert leaves a reader unable to
  tell whether the tree was left dirty.

### Claude's Discretion

The user answered "you decide" on all three questions put to them — the
enforcement point, the gated status set, and the override hatch. Every `D-12-*`
above is therefore Claude's call, made under the reasoning stated inline, and
the planner may revise any of them **if it can state a better reason** — with two
exceptions that are correctness constraints rather than preferences:

- `D-12-09` (gate test named outside the `docs-*` glob) — violating it makes
  the gate recurse into itself.
- `D-12-04` (hook matcher covers `Bash`) — violating it leaves a heredoc
  bypass wide open.

Further latitude explicitly granted to research and planning: the exact
CLI/exit-code contract of `scripts/audit-gate.mjs`, how it is told which text to
inspect (path argument vs stdin), where the `*MILESTONE-AUDIT*.md` discovery
glob is rooted (`.planning/` vs `.planning/milestones/`), and whether the
`PreToolUse` hook shells the script directly or via a thin wrapper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

ROADMAP.md carries no `Canonical refs:` line for this phase — the list below was
assembled during this discussion from REQUIREMENTS.md, the codebase scout, and
the guards themselves.

### The requirement and the phase contract
- `.planning/ROADMAP.md` § "Phase 12: Audit Integrity Instrument" — goal, the
  three success criteria, and the `4f048bb` rationale for sequencing it first
- `.planning/REQUIREMENTS.md:39` — `GATE-01`, the one requirement this phase
  satisfies
- `.planning/REQUIREMENTS.md:40` — `GATE-02`, Phase **15**'s requirement. Read it
  to know what Phase 12 must **not** do: 12 builds the instrument, 15 makes
  `docs-review-disposition.test.ts` green for real.

### The four guards being gated
- `.claude/mcp/vice/docs-linerefs.test.ts` — CLAUDE.md's `vice-proxy.ts:<N>`
  citations. The guard to red for D-12-18's proof.
- `.claude/mcp/vice/docs-dangling-refs.test.ts` — no shipped string literal names
  a phase number
- `.claude/mcp/vice/docs-deferred-ledger.test.ts` — `STATE.md` § Deferred Items
  ↔ `.planning/todos/pending/`, two-directional
- `.claude/mcp/vice/docs-review-disposition.test.ts` — every `*-REVIEW.md`
  finding id has a disposition somewhere. **Read its header comment** — the
  "SCOPE FENCE" and "a guard that demanded specific phrasing would get switched
  off" reasoning is the design philosophy Phase 12's gate must not violate.

### Precedent this phase must follow, not reinvent
- `.claude/mcp/vice/test-gate.mjs` — the single-source-of-truth list pattern and
  `MANUAL_ONLY_TESTS`, the seven suites D-12-11 keeps the gate clear of. Its
  header's "WHAT NOT TO DO: do not re-list these names anywhere else" is the rule
  D-12-07 generalises.
- `.claude/mcp/vice/test-gate.test.ts` — the drift guard that makes a frozen list
  safe; read it to see why a *derived* set (D-12-07) needs a floor instead.
- `.claude/mcp/vice/hostpath-consumers.test.ts` — the `readdirSync`-derived set
  plus `>= 14` floor that D-12-07/D-12-08 copy directly
- `scripts/check-skill-tool-coverage.mjs` — committed planted-violation proof of
  non-vacuousness, the pattern D-12-16 follows

### What the gate parses and where enforcement attaches
- `.planning/milestones/v0.3.0-MILESTONE-AUDIT.md` — the exact frontmatter shape
  (`status: passed`, `round:`, `scores:`) the gate must recognise
- `.planning/milestones/v0.2.0-MILESTONE-AUDIT.md` — a **`tech_debt`** close, the
  real precedent behind D-12-12
- `.github/workflows/ci.yml:110-122` — the `Test` step; Layer 1's CI attachment
  point
- `.claude/mcp/vice/package.json` — `test`, `test:automated`, `typecheck`,
  `smoke` scripts
- `.gitignore:51-55` — the existing decision that `.claude/settings.json` is
  machine-specific and uncommittable, which D-12-05 amends rather than overrides
- `~/.claude/get-shit-done/workflows/audit-milestone.md` §6 (external to this
  repo, read-only) — where `status:` is written. Confirms the audit runs no
  project tests and GSD exposes **no** audit extension hook, which is why
  enforcement must be repo-owned.

### Live-verified context (2026-08-21, this discussion)
- `.planning/STATE.md` § Pending Todos — records the disposition guard "already
  red at `4f048bb`", the exact failure this phase prevents recurring
- `.planning/STATE.md` § Decisions — the accumulated `D-*` log this phase's
  decisions join

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.claude/mcp/vice/test-gate.mjs`** — already knows how to spawn `node --test`
  over a computed file set and interpret the result. `scripts/audit-gate.mjs`
  should reuse its spawn/interpret shape rather than invent a second one, while
  keeping its own *set* derivation (docs guards, not the automated subset).
- **`hostpath-consumers.test.ts`** — a working `readdirSync`-derived-set-plus-floor
  implementation to copy for D-12-07/D-12-08.
- **`docs-review-disposition.test.ts`'s planted-violation pair** — a working
  template for D-12-16's synthetic-tree red/green cases.
- **`.claude-plugin/plugin.json`** — already declares a `SessionStart` hook, so
  the repo has a committed precedent for declaring hooks; note it is
  `defaultEnabled: false` and plugin-gated, which is why D-12-05 uses
  `.claude/settings.json` for this repo's own sessions instead.

### Established Patterns
- **Single seam per concern** — one file owns each cross-cutting responsibility;
  `scripts/audit-gate.mjs` must be the only place the gate's logic lives, with
  both layers calling it (D-12-01).
- **Guard-removal-sensitivity as a design goal** (`TESTING.md`) — every test is
  written so it fails if the property is removed, not merely absent from a
  description. D-12-16's planted pair is how this phase satisfies it.
- **Derive from ground truth, add a floor** — the direction 11.1-03 moved the
  codebase; hand-typed lists are the defect class, not the fix.
- **Node built-in test runner, `node:assert/strict`, no new dependencies**;
  standalone scripts are `.mjs` with a `#!/usr/bin/env node` shebang.
- **Long structured header comments stating WHY the file exists**, naming the
  dated incident that motivated it. `scripts/audit-gate.mjs` must name
  `4f048bb` / the v0.3.0 close.
- **`docs-*.test.ts` are deliberately excluded from `package.json`'s `files[]`**
  (see `scripts/check-npm-packages.mjs`) — they verify planning documentation,
  not shipped runtime behaviour. The new gate test and `scripts/audit-gate.mjs`
  must stay out of both published tarballs, and `check-npm-packages.mjs` must
  still pass.

### Integration Points
- `.claude/mcp/vice/` — home of the new gate test, picked up by
  `node --test '*.test.*'` automatically
- `scripts/` — home of `audit-gate.mjs`, alongside the four existing
  `check-*.mjs` CI gates
- `.claude/settings.json` (new, hooks-only, committed) + `.claude/settings.local.json`
  (permissions, stays ignored) + `.gitignore:51-55` (comment amended)
- `.github/workflows/ci.yml` — no change needed if the gate test lives in
  `.claude/mcp/vice/` and rides the existing `Test` step; confirm rather than
  assume
- `.planning/` — the tree the gate scans for `*MILESTONE-AUDIT*.md`

</code_context>

<specifics>
## Specific Ideas

- The refusal must be provably non-bypassable **from inside a session**, which
  is why `PreToolUse` + `exit 2` was chosen over a `PostToolUse` warning: it
  runs before deny/allow rules and permission-mode checks, and `exit 2` blocks
  even when the hook's own JSON says allow.
- "Mechanically enforced, not documented" is the phrase to test every design
  choice against. If a step could be skipped by a future session simply not
  reading something, it does not count.
- The gate's own failure output should read like the existing guards' — name the
  property, the offending value, and the route to fix — not a bare non-zero exit.

</specifics>

<deferred>
## Deferred Ideas

- **Gate phase-level `VERIFICATION.md` `status: passed` too.** Structurally the
  same instrument and arguably the same defect class, but `GATE-01` names the
  *milestone* audit and phase verification has different semantics (a phase can
  legitimately pass while a repo-wide docs guard is red for unrelated reasons).
  Revisit if a phase verification is ever found to have passed over a red guard.
- **Gate `/gsd-complete-milestone` (the archive-and-tag step) rather than the
  audit.** Considered and set aside: it moves the check downstream of `GATE-01`'s
  stated wording. D-12-12 closes the same hole from the audit side instead.
- **Making `.planning/`'s other derived invariants gate the close** (e.g. the
  `STATE.md` progress-line drift that recurred through Phase 08.1). Same
  instrument, wider scope — its own phase if wanted.

### Reviewed Todos (not folded)

- **`2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`** (matched 0.6,
  `resolves_phase: null`) — whether CI should switch from bare `npm test` to
  `npm run test:automated`. Genuinely adjacent, deliberately **not folded**:
  it is a separate question with release consequences (every merge to `main`
  auto-publishes), and folding it would expand this phase. **D-12-11 exists
  partly to keep Phase 12 from silently settling it** — the gate calls the four
  guard files directly, so it holds regardless of which command CI runs. A
  planner must not "helpfully" resolve this todo while wiring Layer 1.
- **`2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md`**
  (matched 0.9, highest score) — not folded: it is tagged `resolves_phase: 16`
  and is about stale phase pointers in source comments, not audit integrity.
- **`2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`** (matched 0.6)
  — not folded: already dispositioned 2026-08-12 ("not a bug to fix"). Relevant
  only as the reason D-12-11 keeps the gate clear of `MANUAL_ONLY_TESTS`.
- **The three `resolves_phase: 13` todos** (`re-record-binmon-fixtures`,
  `confirm-help-discriminator`, `probe-phase3-assumed-wire-details`) matched on
  generic keywords only. They belong to Phase 13.

No todo in `.planning/todos/pending/` carries `resolves_phase: 12`, so this
phase closes none — consistent with `DEBT-04`'s ledger count being measured in
Phase 17, not here.

</deferred>

---

*Phase: 12-audit-integrity-instrument*
*Context gathered: 2026-08-21*
