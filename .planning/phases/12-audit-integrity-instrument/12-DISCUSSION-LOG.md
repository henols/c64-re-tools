# Phase 12: Audit Integrity Instrument - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 12-audit-integrity-instrument
**Areas discussed:** Enforcement point, Guard-set definition, Blast radius, Proof artifacts

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Enforcement point | Where the refusal physically happens | ✓ |
| Guard-set definition | Frozen list vs glob; live re-run vs recorded artifact | ✓ |
| Blast radius | Which statuses; phase VERIFICATION.md; override hatch | ✓ |
| Proof artifacts | How the deliberate-red run is produced and where transcripts live | ✓ |

**User's choice:** all four areas.

---

## Enforcement point

Findings presented before the question, since they eliminated options:

- `~/.claude/get-shit-done/workflows/audit-milestone.md` runs **no project
  tests** and GSD exposes **no audit extension hook** (`hooks.workflow_guard` is
  a GSD-internal toggle; no hook scripts exist anywhere in the install).
  Enforcement must therefore be repo-owned.
- `.claude/settings.json` is **gitignored by deliberate decision**
  (`.gitignore:51-55`: "machine-specific and must not be committed").
- `core.hooksPath` is unset and is per-clone config, never committed.
- Only a test in the suite survives a clean checkout with zero new
  infrastructure.
- Web-confirmed `PreToolUse` semantics: runs first in the permission chain,
  `exit 2` blocks the tool call regardless of permission mode, and cannot be
  overridden by the hook's own JSON.

| Option | Description | Selected |
|--------|-------------|----------|
| Committed script + suite test | `scripts/audit-gate.mjs` + a committed test asserting no audit declares `passed` while a guard is red. Clean-checkout-proof, CI-enforced, zero new infra. Does not literally refuse the write. | |
| Script + test + `PreToolUse` hook | Same, plus a hook denying the write at the moment of recording. Requires resolving the gitignored-settings.json conflict. | ✓ (Claude's call) |
| Script + committed git hook | `scripts/githooks/pre-commit`. Rejected: `core.hooksPath` is per-clone, so a fresh clone has no enforcement. | |
| You decide | — | ← user |

**User's choice:** "You decide."
**Notes:** Claude selected the layered option. Reasoning recorded: criterion 1's
wording is "refusing to **record**", which only a `PreToolUse` deny satisfies
literally; the suite test is what survives a clean checkout; and the .gitignore
rationale is specifically about machine-specific *permission* content, so
splitting hooks (committed) from permissions (`settings.local.json`, ignored)
honours it rather than overriding it. Two design constraints surfaced during the
decision: the hook matcher must cover `Bash` (heredoc bypass), and the gate's own
test must be named outside the `docs-*` glob or it recurses into itself.

---

## Blast radius

| Option | Description | Selected |
|--------|-------------|----------|
| `passed` only | Literal `GATE-01`. Leaves the `tech_debt` + "proceed anyway" hole. | |
| `passed` and `tech_debt` | Blocks both statuses that route to `/gsd-complete-milestone`. Stricter than `GATE-01` says. | ✓ (Claude's call) |
| Any status, gate the close instead | Gate `/gsd-complete-milestone`. Diverges from `GATE-01`'s wording. | |

| Option | Description | Selected |
|--------|-------------|----------|
| No hatch — absolute | Red guard means no clean verdict, full stop. | ✓ (Claude's call) |
| Committed waiver file | Auditable, but a documented escape. | |
| Env-var hatch | Cheap, leaves no record — the `4f048bb` failure mode. | |

**User's choice:** "you decide" on both.
**Notes:** Claude chose `passed` + `tech_debt` because v0.2.0 legitimately closed
as `tech_debt` and the audit's own output offers "proceed anyway — accept tech
debt", making a `passed`-only gate a one-word bypass. Added
`gaps_found` is explicitly **never** gated — the gate must never obstruct honest
bad news. Chose no hatch because this phase exists precisely because a documented
escape did not hold; the legitimate route when a guard is wrong is a commit that
fixes or retires it, which leaves a trace. Consequence noted: with no hatch, the
refusal message becomes load-bearing and must name the red guard, its failing
assertion, and the two legitimate routes.

---

## Guard-set definition

Not put to the user — resolved from repo precedent, which pointed one way
unambiguously.

**Decided:** glob `docs-*.test.ts`, derived from the tree, with a `>= 4` floor
and the four current names asserted present; guards re-run live in a subprocess
(~215 ms measured) rather than read from a recorded artifact; invoked directly
rather than via `npm test` / `test:automated`.

**Notes:** Plan 11.1-03 replaced `hostpath-consumers.test.ts`'s hard-coded
10-name array with a `readdirSync`-derived list plus a `>= 14` floor,
*explicitly as the improvement* — so a derived set is the repo's current
direction and a frozen list would be a regression. The floor exists because a
derived set that silently matches nothing is a vacuous gate.

---

## Proof artifacts

Not put to the user — house style was unambiguous.

**Decided:** a permanent committed planted-violation test pair (synthetic tree,
red guard + synthetic `passed` audit → refused; all green → allowed) as the
primary proof, plus a one-time real-tree red/green transcript. `docs-linerefs.test.ts`
is the guard to red (one digit in CLAUDE.md, one-character revert, no product-code
risk). Transcripts live as a phase artifact, following `08.1-WALKTHROUGH-EVIDENCE.md`.

**Notes:** `docs-review-disposition.test.ts` already ships exactly this planted
pair, as does `check-skill-tool-coverage.mjs`; a transcript proves it worked
once, a committed test proves it keeps working. `docs/` was rejected as the
transcript home because this repo reserves it for durable cross-milestone
findings. Explicitly excluded as red-candidates:
`docs-review-disposition.test.ts` (needs a todo moved) and
`docs-deferred-ledger.test.ts` (needs `STATE.md` edited, which other things
derive from).

---

## Claude's Discretion

The user answered "you decide" on all three questions put to them. Every
`D-12-*` decision in CONTEXT.md is therefore Claude's, with reasoning recorded
inline and the planner free to revise on a better reason — except D-12-09
(gate test named outside the `docs-*` glob) and D-12-04 (hook matcher covers
`Bash`), which are correctness constraints.

Left open for research and planning: `scripts/audit-gate.mjs`'s exact
CLI/exit-code contract, how it receives the text to inspect, where the
`*MILESTONE-AUDIT*.md` discovery glob is rooted, and whether the hook shells the
script directly or via a wrapper.

## Deferred Ideas

- Gate phase-level `VERIFICATION.md` `status: passed` too — same instrument,
  different semantics; `GATE-01` names the milestone audit.
- Gate `/gsd-complete-milestone` instead of the audit — moves the check
  downstream of `GATE-01`'s wording.
- Gate `.planning/`'s other derived invariants (e.g. the recurring `STATE.md`
  progress-line drift) — same instrument, wider scope, its own phase.
- `2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md` reviewed and
  deliberately not folded; D-12-11 keeps Phase 12 from silently settling it.
