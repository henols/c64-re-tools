# Phase 12: Audit Integrity Instrument - Research

**Researched:** 2026-08-21
**Domain:** Claude Code `PreToolUse` hooks, Node built-in test runner as a live enforcement gate, YAML-frontmatter-in-Markdown parsing
**Confidence:** HIGH (every mechanical claim below was verified against this exact repo/host, not asserted from training data)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Enforcement point**

- **D-12-01:** The single check point is a committed executable script,
  `scripts/audit-gate.mjs`. Every enforcement layer calls it; the logic exists
  in exactly one place. This is the file criterion 3 cites by line.
- **D-12-02:** **Layer 1 (clean-checkout-proof)** — a committed test in
  `.claude/mcp/vice/` calls `scripts/audit-gate.mjs` and asserts that no
  `*MILESTONE-AUDIT*.md` under `.planning/` declares a gated status while any
  docs guard is red. Runs under `npm test` and `npm run test:automated`, CI
  runs it on every merge to `main`, and every merge to `main` auto-publishes a
  patch release — so there is no path to a release past a red gate.
- **D-12-03:** **Layer 2 (refuses the write itself)** — the same script is
  wired as a Claude Code `PreToolUse` hook that denies any tool call writing a
  gated status into a `*MILESTONE-AUDIT*.md` while a guard is red. `PreToolUse`
  runs first in the permission chain and `exit 2` blocks the call regardless of
  permission mode.
- **D-12-04:** The hook matcher **must cover `Bash` in addition to `Write` and
  `Edit`.** A `cat > file <<EOF` heredoc is the obvious bypass and it is the
  shape this repo's own agents use constantly. Layer 1 is the backstop for
  anything the matcher still misses; do not treat the hook as sufficient alone.
  **Hard correctness constraint — not a style preference.**
- **D-12-05:** Wiring Layer 2 requires committing `.claude/settings.json`
  (currently ignored by `.gitignore:55`). **Split it rather than un-ignoring
  it wholesale:** commit a `.claude/settings.json` containing *hooks only*, and
  move the existing machine-specific permission allowlist (absolute worktree
  paths) into `.claude/settings.local.json`, which stays ignored via the
  user's global gitignore. Amend `.gitignore:51-55`'s comment to record the
  split and why. Do not commit absolute paths.
- **D-12-06:** Rejected: a committed `scripts/githooks/pre-commit` as the
  primary layer — `core.hooksPath` is per-clone git config and is not
  committed, so a fresh clone has no enforcement until a setup step runs.

**Guard-set definition**

- **D-12-07:** The guard set is **derived from the tree**, not listed: glob
  `docs-*.test.ts` in `.claude/mcp/vice/`. Precedent: plan 11.1-03 replaced
  `hostpath-consumers.test.ts`'s hard-coded array with a `readdirSync`-derived
  list as the improvement.
- **D-12-08:** The glob carries a **floor of `>= 4` plus an assertion that the
  four current names are present** — a derived set that silently matches
  nothing is a vacuous gate.
- **D-12-09:** **Name the gate's own test outside the `docs-*` glob** — e.g.
  `audit-integrity.test.ts`, not `docs-audit-integrity.test.ts`. **Hard
  correctness constraint — not a style preference**: a `docs-`-prefixed name
  would make the gate recurse into itself.
- **D-12-10:** The gate **re-runs the guards live in a subprocess** rather
  than reading a recorded result artifact. All four together cost ~215 ms; a
  recorded artifact is precisely the stale-derived-state failure mode
  `docs-deferred-ledger.test.ts` exists to prevent.
- **D-12-11:** The gate invokes the four guard files **directly**
  (`node --test docs-*.test.ts`), never `npm test` or `npm run test:automated`.
  Must not depend on `test-gate.mjs`'s `MANUAL_ONLY_TESTS`, and must not be
  reachable into a hang. Keeps Phase 12 independent of the open
  which-command-should-CI-run question.

**Blast radius**

- **D-12-12:** The gate refuses **both `status: passed` and `status:
  tech_debt`.** Both route to `/gsd-complete-milestone`. Deliberately
  **stricter than `GATE-01` says** — record as a decision in the phase SUMMARY.
- **D-12-13:** **`status: gaps_found` is never gated.** An audit must always be
  able to say "a guard is red."
- **D-12-14:** **No override hatch — the gate is absolute.** No waiver file, no
  env var. The legitimate route when a guard is genuinely wrong is to fix or
  retire it in a commit, visible in history.
- **D-12-15:** Because there is no hatch, the refusal message is load-bearing.
  Must name (a) which guard is red, (b) its failing assertion text, (c) the
  two legitimate routes (fix the documents, or change/retire the guard in a
  commit).

**Proof artifacts**

- **D-12-16:** The primary proof is a **permanent committed test case**:
  inside `audit-integrity.test.ts`, build a synthetic tree with a
  deliberately-red guard file plus a synthetic audit declaring `status:
  passed`, and assert the gate refuses; add its mirror (all guards green →
  allowed).
- **D-12-17:** The one-time **real-tree** red/green run is done by
  **plant-and-revert on the real repo**, house style.
- **D-12-18:** **Red `docs-linerefs.test.ts` for that run** — changing one
  digit in CLAUDE.md reds it deterministically; reverting is a
  zero-risk one-character undo. Do NOT red `docs-review-disposition.test.ts`
  or `docs-deferred-ledger.test.ts`.
- **D-12-19:** Both transcripts live as a **phase artifact** in
  `.planning/phases/12-audit-integrity-instrument/`, following
  `08.1-WALKTHROUGH-EVIDENCE.md`'s convention — not under `docs/`.
- **D-12-20:** The transcript must record the **revert** as explicitly as the
  plant — verified green again afterwards, with the guard's own output shown.

### Claude's Discretion

The user answered "you decide" on all three questions put to them — the
enforcement point, the gated status set, and the override hatch. Every
`D-12-*` decision is Claude's call and **may be revised by the planner if it
can state a better reason**, with two exceptions that are correctness
constraints rather than preferences:

- **D-12-09** (gate test named outside the `docs-*` glob) — violating it makes
  the gate recurse into itself.
- **D-12-04** (hook matcher covers `Bash`) — violating it leaves a heredoc
  bypass wide open.

Further latitude explicitly granted to research and planning: the exact
CLI/exit-code contract of `scripts/audit-gate.mjs`, how it is told which text
to inspect (path argument vs stdin), where the `*MILESTONE-AUDIT*.md`
discovery glob is rooted (`.planning/` vs `.planning/milestones/`), and
whether the `PreToolUse` hook shells the script directly or via a thin
wrapper.

### Deferred Ideas (OUT OF SCOPE)

- **Gate phase-level `VERIFICATION.md` `status: passed` too.** Structurally
  the same instrument, but `GATE-01` names the *milestone* audit and phase
  verification has different semantics. Revisit if a phase verification is
  ever found to have passed over a red guard.
- **Gate `/gsd-complete-milestone` (the archive-and-tag step) rather than the
  audit.** Considered and set aside — moves the check downstream of GATE-01's
  stated wording. D-12-12 closes the same hole from the audit side instead.
- **Making `.planning/`'s other derived invariants gate the close** (e.g. the
  `STATE.md` progress-line drift). Same instrument, wider scope — its own
  phase if wanted.
- No todo in `.planning/todos/pending/` carries `resolves_phase: 12` — this
  phase closes none.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | A milestone audit cannot record `status: passed` while any of the four `docs-*.test.ts` guards is red — the precondition is mechanically enforced, not documented | Verified PreToolUse hook contract (exit-2 semantics, matcher syntax) for Layer 2; verified `node:test`/`spawnSync` nesting and directory-parameterized-function pattern for Layer 1; verified the exact frontmatter-vs-prose false-positive risk in both archived `*-MILESTONE-AUDIT.md` files, which determines how `status:` must be detected; verified the live write location (`.planning/v{version}-MILESTONE-AUDIT.md`) via the `audit-milestone` GSD workflow source |

</phase_requirements>

## Summary

Phase 12 needs no new library and no new external service — it is entirely Node
built-ins (`node:test`, `node:child_process`, `node:fs`) plus one Claude Code
platform feature (`PreToolUse` hooks) that this exact host (Claude Code 2.1.238)
already uses in its own global `~/.claude/settings.json`. Every mechanical claim
CONTEXT.md's `D-12-*` decisions depend on has now been checked directly against
the real tree or a disposable throwaway script, not assumed:

- The four `docs-*.test.ts` guards run in **0.215s wall clock** today (`time node
  --test docs-*.test.ts` in `.claude/mcp/vice/`), confirming CONTEXT.md's D-12-10
  "~215ms" figure to the millisecond.
- Nested `node --test` (a test spawning `node --test` as a subprocess) **works
  cleanly** on this host's Node v22.22.0 — verified with a disposable throwaway
  outer/inner test pair, exit code 0, no TAP interleaving corruption. This
  de-risks D-12-16's "committed test case calls `scripts/audit-gate.mjs`, which
  itself spawns `node --test`" nesting.
- **The single biggest false-positive risk CONTEXT.md did not fully spell out:**
  both `.planning/milestones/v0.2.0-MILESTONE-AUDIT.md` and
  `v0.3.0-MILESTONE-AUDIT.md` contain **a dozen-plus non-frontmatter occurrences
  of the literal string `status: passed`** inside backtick-quoted prose, quoting
  *other files'* status lines (e.g. `` `08-VERIFICATION.md` is reconciled —
  frontmatter `status: passed`... ``). A naive whole-document
  `grep 'status: passed'` gate would false-positive on every one of these. The
  gate must scan **only the YAML frontmatter's own top-level `status:` key**
  (between the first and second `---` delimiters, at column zero) — exactly the
  line-scan technique `docs-review-disposition.test.ts`'s `extractTechDebtBlock()`
  already uses for the identical reason (a lookahead-regex version of that
  function once truncated to 43 characters on this same file; see that
  function's own header comment, `docs-review-disposition.test.ts:159-183`).
- The live `PreToolUse` hook JSON contract was **read directly out of this
  machine's own working, committed hook scripts** (`~/.claude/hooks/gsd-*.js`,
  `~/.claude/hooks/gsd-validate-commit.sh`), not out of fetched documentation —
  and the fetched official docs (via WebFetch) **disagree with the empirical
  scripts** on the exact `tool_input` field names for `Write`/`Edit`. This
  discrepancy is called out explicitly below; the planner must trust the
  empirically-observed field names or verify a third way before shipping.
- `scripts/` (repo root) is invisible to both npm tarballs by construction
  (`check-npm-packages.mjs` already asserts `!vice.files.some(f =>
  f.startsWith("scripts/"))`), and any new `*.test.ts` is invisible to both npm
  tarballs by omission from `package.json`'s `files[]` allowlist, not by any
  action the planner needs to take. **A third, separate packaging path exists
  that CONTEXT.md's "Established Patterns" note does not mention:**
  `scripts/package.sh`'s plugin zip is `git archive HEAD` — the *entire* tracked
  tree. `.planning/` (526 tracked files) and every `docs-*.test.ts` already ship
  inside today's plugin zip. This is pre-existing, unremarked behavior, not a
  regression this phase would introduce — no new exclusion work is needed for
  `scripts/audit-gate.mjs` or `audit-integrity.test.ts` in the plugin zip either.

**Primary recommendation:** Give `scripts/audit-gate.mjs` a small set of
**directory-parameterized, exported pure(ish) functions** — mirroring
`test-gate.mjs`'s own `automatedTestFiles(dir)` shape exactly — rather than a
single opaque `main()`. `audit-integrity.test.ts` imports those functions
directly and points them at a `mkdtempSync`-built synthetic tree (the
established pattern for multi-file synthetic trees in this codebase,
`install-resources.test.ts`); the `PreToolUse` hook and Layer 1's own
clean-checkout test both call the same functions pointed at the real repo root.
Capture the guard subprocess's stdout (`{ encoding: "utf8" }`, not
`test-gate.mjs`'s `stdio: "inherit"`) so the refusal message can quote the
actual failing assertion text, per D-12-15.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Is any docs guard red right now?" (live re-run) | Repo-owned Node script (`scripts/audit-gate.mjs`) | — | D-12-01/D-12-10: single seam, subprocess re-run, no cached artifact |
| "Does this text declare a gated status?" (frontmatter parse) | Same script, same seam | — | D-12-01: one script answers both questions so there is exactly one place the logic lives |
| Clean-checkout enforcement (survives `git clone`, runs in CI) | `.claude/mcp/vice/audit-integrity.test.ts` (`node:test`) | GitHub Actions `Test` step (`.github/workflows/ci.yml:110-122`) | D-12-02: this is the layer that cannot be bypassed by not having hooks configured |
| In-session write refusal (the moment of recording) | Claude Code `PreToolUse` hook (`.claude/settings.json`, project-scoped) | — | D-12-03/D-12-04: runs before permission-mode checks, `exit 2` cannot be overridden by any JSON the hook itself prints |
| Guard-set membership (which files count as "a docs guard") | `readdirSync` over `.claude/mcp/vice/docs-*.test.ts` inside `scripts/audit-gate.mjs` | — | D-12-07/D-12-08: derived-from-tree-plus-floor, same shape as `hostpath-consumers.test.ts` |
| Milestone-audit file discovery | Same script, scanning `.planning/*MILESTONE-AUDIT*.md` (top-level only) | — | Matches the live location the `audit-milestone` GSD workflow actually writes to (`.planning/v{version}-MILESTONE-AUDIT.md`) and `docs-review-disposition.test.ts`'s existing `topLevelMilestoneAuditFiles()` precedent of never recursing into `.planning/milestones/` (archived/closed rounds) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` (built-in) | Node 22.22.0 (repo floor: `>=22.18.0`, `package.json:76`) | Runs the four docs guards and the new `audit-integrity.test.ts` | Already the repo-wide test runner; zero new dependency |
| `node:child_process` `spawnSync` (built-in) | Node 22.22.0 | Re-runs guards live in a subprocess (D-12-10) | Exact precedent: `test-gate.mjs:94-98`'s `runNodeTest()` |
| `node:fs` `mkdtempSync`/`readdirSync`/`readFileSync` (built-in) | Node 22.22.0 | Synthetic-tree construction, guard-set derivation, frontmatter scan | Precedent: `install-resources.test.ts` (mkdtempSync), `hostpath-consumers.test.ts` (readdirSync-plus-floor) |
| Claude Code `PreToolUse` hooks | Claude Code 2.1.238 (this host) | Layer 2, in-session write refusal | Confirmed working today in `~/.claude/settings.json` (`matcher: "Write\|Edit"` and `matcher: "Bash"` entries already fire in this exact session) |

**No new npm dependency is introduced by this phase.** `scripts/audit-gate.mjs`
is a standalone `.mjs` script per this repo's established convention (`#!/usr/bin/env node`
shebang, no imports outside `node:*` and first-party local modules) — same shape
as `scripts/check-npm-packages.mjs` and `scripts/check-skill-tool-coverage.mjs`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `PreToolUse` hook in committed `.claude/settings.json` | Committed `scripts/githooks/pre-commit` + `core.hooksPath` | Rejected in CONTEXT.md (D-12-06): `core.hooksPath` is per-clone git config, not committed — reintroduces the exact clean-checkout hole this phase exists to close |
| Live subprocess re-run of guards | Read a cached/recorded pass-fail artifact | Rejected in CONTEXT.md (D-12-10): a recorded artifact is precisely the stale-derived-state failure mode `docs-deferred-ledger.test.ts` exists to prevent |
| `spawnSync` with `{ encoding: "utf8" }` (captured output) | `spawnSync` with `stdio: "inherit"` (test-gate.mjs's own choice) | `stdio: "inherit"` streams TAP straight to the parent's terminal but gives the caller no string to build a refusal message (D-12-15) from — capture is required here even though it diverges from the precedent's own choice |

**Installation:** none — no `npm install` step for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (no `npm
install`, no new `dependencies`/`devDependencies` entries). The Package
Legitimacy Gate protocol is not triggered.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │  scripts/audit-gate.mjs  (single seam)   │
                    │                                           │
                    │  findDocsGuards(viceDir) ──► readdirSync  │
                    │        │ floor >= 4, names present         │
                    │        ▼                                  │
                    │  runGuardsLive(viceDir, guardFiles)        │
                    │        │ spawnSync(node, ["--test", ...])  │
                    │        │ { encoding: "utf8" }              │
                    │        ▼                                  │
                    │  redGuardReport | null                     │
                    │        │                                  │
                    │  findGatedAuditText(planningDir)            │
                    │        │ scan *MILESTONE-AUDIT*.md          │
                    │        │ frontmatter-only status: line      │
                    │        ▼                                  │
                    │  checkAuditGate({ viceDir, planningDir })   │
                    │        │ combines both above                │
                    │        ▼                                  │
                    │  { allowed: bool, reason: string }          │
                    └───────┬───────────────────┬────────────────┘
                            │                   │
              ┌─────────────▼───────┐ ┌─────────▼──────────────────┐
              │ Layer 1 (clean-     │ │ Layer 2 (PreToolUse hook)   │
              │ checkout proof)     │ │                             │
              │                     │ │ stdin: {tool_name,           │
              │ audit-integrity     │ │   tool_input: {file_path,    │
              │ .test.ts imports    │ │   content|new_string|command}}│
              │ the functions above │ │                             │
              │ directly, points    │ │ For Write/Edit: file_path    │
              │ them at BOTH the    │ │   matches *MILESTONE-AUDIT*.md│
              │ real repo AND a     │ │   AND content/new_string      │
              │ mkdtempSync         │ │   declares a gated status     │
              │ synthetic tree      │ │ For Bash: command string      │
              │                     │ │   scanned for the same shape  │
              │ Runs under          │ │   (heredoc/>>/tee bypass)      │
              │ `npm test` +        │ │                             │
              │ `npm run            │ │ exit 2 + stderr reason        │
              │ test:automated` +   │ │   = block, regardless of any  │
              │ CI (ci.yml:110-122) │ │   JSON printed on stdout       │
              └─────────────────────┘ └─────────────────────────────┘
```

### Recommended Project Structure
```
scripts/
├── audit-gate.mjs           # NEW — the single check point (D-12-01)
.claude/mcp/vice/
├── audit-integrity.test.ts  # NEW — Layer 1, named OUTSIDE docs-* glob (D-12-09)
├── docs-linerefs.test.ts    # existing guard 1 of 4
├── docs-dangling-refs.test.ts   # existing guard 2 of 4
├── docs-deferred-ledger.test.ts # existing guard 3 of 4
├── docs-review-disposition.test.ts # existing guard 4 of 4
.claude/
├── settings.json             # NEW, committed, HOOKS ONLY (D-12-05)
├── settings.local.json       # existing, stays gitignored, permissions only
.planning/phases/12-audit-integrity-instrument/
├── 12-RED-TRANSCRIPT.md      # or similarly named — the plant-and-revert proof (D-12-17..20)
```

### Pattern 1: Directory-parameterized guard functions (not a bare CLI script)
**What:** Export functions that take the scanned directory as an explicit
argument, exactly like `test-gate.mjs`'s `automatedTestFiles(dir)`.
**When to use:** Any time a script must be BOTH a CLI entry point AND
importable/pointable-at-a-synthetic-tree by a test.
**Example (precedent, not yet written for this phase):**
```javascript
// Source: .claude/mcp/vice/test-gate.mjs:82-88 (existing precedent this phase reuses)
export function automatedTestFiles(dir) {
  const all = readdirSync(dir).filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f));
  return all.filter((f) => !MANUAL_ONLY_TESTS.includes(f)).sort();
}
```
`scripts/audit-gate.mjs` should follow the identical shape: `findDocsGuards(viceDir)`,
`runGuardsLive(viceDir, files)`, `findGatedAuditText(planningDir)`, and a
combining `checkAuditGate({ viceDir, planningDir })` — each independently
testable against a synthetic root, with a thin `main()` at the bottom guarded
by the same `import.meta.url === \`file://${process.argv[1]}\`` check
`test-gate.mjs:108` already uses.

### Pattern 2: Frontmatter-only status detection (column-zero line scan)
**What:** Extract only the top-level YAML frontmatter `status:` key, never a
whole-document regex/grep.
**When to use:** Any time a Markdown document's frontmatter key name also
appears, quoted, in the document's own prose (a documented, *live*, repeated
occurrence in this exact codebase — see Common Pitfalls below).
**Example:**
```typescript
// Source: .claude/mcp/vice/docs-review-disposition.test.ts:171-183 (existing,
// adapt directly rather than re-deriving — this function already solves the
// "bare $ under /m matches every line" trap for this exact document shape)
function extractTechDebtBlock(auditContent: string): string {
  const lines = auditContent.split("\n");
  const startIdx = lines.findIndex((l) => l === "tech_debt:");
  if (startIdx === -1) return "";
  const blockLines: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "---") break; // end of frontmatter
    if (/^[a-zA-Z_]/.test(line)) break; // next column-zero (top-level) key
    blockLines.push(line);
  }
  return blockLines.join("\n");
}
```
Adapt this exact technique for `status:` — find the line `status: <value>`
occurring between the first `---` and the matching closing `---`, at column
zero, and read ONLY that value. Reject `status:` occurrences found via a bare
document-wide regex.

### Pattern 3: Planted-violation / planted-false-negative pair
**What:** Every non-vacuous guard in this codebase ships a committed pair of
tests: one proving the guard bites on a deliberately bad synthetic input, one
proving it does not bite on a deliberately good one.
**When to use:** D-12-16 requires exactly this pair for `audit-gate.mjs`.
**Example:**
```typescript
// Source: .claude/mcp/vice/docs-review-disposition.test.ts:291,319 (the
// house standard this phase's proof pair must match)
test("planted violation: a synthetic finding id mentioned nowhere is reported undispositioned", () => { /* ... */ });
test("planted false-negative: the same synthetic id WITH a disposition source present is reported dispositioned", () => { /* ... */ });
```
For Phase 12: one test builds a `mkdtempSync` tree with a deliberately-failing
synthetic `docs-*.test.ts`-shaped file plus a synthetic `*MILESTONE-AUDIT*.md`
declaring `status: passed`, and asserts `checkAuditGate()` refuses. The mirror
flips the synthetic guard to pass and asserts the same call allows it.

### Anti-Patterns to Avoid
- **Whole-document `grep`/regex for `status: passed`:** both archived milestone
  audits contain more non-frontmatter occurrences of that literal string than
  frontmatter occurrences (see Common Pitfalls). A gate built this way is
  guaranteed to false-positive on its very first real use.
- **`spawnSync(..., { stdio: "inherit" })` for the gate's own subprocess:**
  correct for `test-gate.mjs`'s use case (a human watching TAP output stream
  by), wrong here — the caller needs the captured text to build D-12-15's
  refusal message.
- **A second, hand-typed guard-file list anywhere:** every existing guard in
  this codebase that started as a hand-typed list (`test-gate.mjs`'s original
  seven-name array is the one surviving exception, explicitly frozen and
  commented "do not add a parallel list") was later found to have drifted.
  D-12-07 already commits to the derived-glob approach; do not regress it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this git commit/session actually inside a Claude Code project" enforcement that survives a fresh clone | A custom git hook registered via `core.hooksPath` | Committed `.claude/settings.json` `PreToolUse` hook + a `node:test` clean-checkout proof (Layer 1) | `core.hooksPath` is per-clone config, never committed (D-12-06's own rejected alternative) |
| YAML frontmatter parsing | A YAML parser dependency (`js-yaml`, etc.) | The existing column-zero line-scan technique (`extractTechDebtBlock`) | This repo's frontmatter is simple enough that a full YAML parser is unneeded machinery; the existing guards already avoid one, and none of GATE-01's three criteria require general YAML |
| Detecting a Bash heredoc/`>>`/`tee` write of a gated status | A shell-command AST parser | A regex/string scan of `tool_input.command` for the *content* shape (`*MILESTONE-AUDIT*.md` filename token + a gated `status:` value token), not the shell syntax used to write it | The gate cares about WHAT gets written, not HOW the shell writes it — matching content, not syntax, catches `cat > f <<EOF`, `echo ... >> f`, `tee f`, and any future shell idiom uniformly |
| Refusal-message assembly | A templating library | Plain string interpolation, matching every other guard's refusal-message style in this repo (name the property, the offending value, the route to fix) | Consistent with the repo-wide convention; no new dependency justified for one message string |

**Key insight:** Every "don't hand-roll" candidate in this phase already has a
committed, working precedent inside `.claude/mcp/vice/` or `scripts/`. The
research task here is citation, not invention — reuse the pattern, don't
reinvent it.

## Common Pitfalls

### Pitfall 1: `status:` appears in prose, not just frontmatter — verified false-positive risk
**What goes wrong:** A gate that scans the whole document text for the literal
string `status: passed` (or `status: tech_debt`) fires on quoted references to
*other files'* status lines.
**Why it happens:** Both archived audits narrate other documents' frontmatter
inline, in backticks, as evidence: `v0.2.0-MILESTONE-AUDIT.md:25` reads
`` `08.2-VERIFICATION.md` now exists — `status: passed`, `score: 7/7... ``,
and `v0.3.0-MILESTONE-AUDIT.md:53/56/59` embed `"status: validated"` /
`"status: verified"` inside `note:` fields. Grep counts (measured directly):
`grep -c "status:" v0.2.0-MILESTONE-AUDIT.md` → **9** occurrences across the
file; only **1** (`status: tech_debt`, line 11) is the file's own frontmatter
key. `v0.3.0-MILESTONE-AUDIT.md` → **4** occurrences; only **1** (`status:
passed`, line 7) is the frontmatter key.
**How to avoid:** Bound the scan to the first frontmatter block only (between
the file's first and second `---` lines at column zero), using the
`extractTechDebtBlock`-style line-scan, not a whole-document regex.
**Warning signs:** If the gate's own non-vacuity test can be satisfied by a
synthetic document containing the target string ANYWHERE (not specifically in
frontmatter), the gate is already wrong in the direction this pitfall describes.

### Pitfall 2: `exit 2` + JSON `permissionDecision` is a documented no-op combination on current Claude Code
**What goes wrong:** A hook that both exits 2 AND prints
`{"hookSpecificOutput":{"permissionDecision":"deny",...}}` on stdout is
betting on two mechanisms at once; per Claude Code's own hooks reference and a
filed upstream issue (anthropics/claude-code#43407), **JSON is only read on
exit 0** — exit 2 blocks unconditionally using **stderr** text as the reason,
and any stdout JSON printed alongside an exit-2 is not guaranteed to be
honored for the `permissionDecision` field.
**Why it happens:** Two different hook output contracts exist in Claude Code's
history/docs (`exit 2` + stderr reason vs. `exit 0` + `hookSpecificOutput.permissionDecision`),
and mixing them is an easy mistake.
**How to avoid:** Pick ONE mechanism. The verified-working local precedent
(`~/.claude/hooks/gsd-validate-commit.sh:47-49`) uses `exit 2` as the actual
blocking mechanism and writes a JSON blob to **stdout** (not stderr) purely as
a courtesy/legacy `"decision": "block"` field — but the load-bearing block is
the exit code itself. **Recommendation for `audit-gate.mjs`'s hook wiring:
`exit 2`, with the full refusal message (D-12-15's three required parts)
written to stderr**, since that is the channel the current docs say is
authoritative for the reason text on an exit-2 block.
**Warning signs:** A hook that appears to log a block reason but the tool call
proceeds anyway is this exact failure mode — verify with a real plant (D-12-17)
before trusting the wiring.

### Pitfall 3: The gate's own test file must not join the set it audits (recursion)
**What goes wrong:** If `scripts/audit-gate.mjs`'s real-repo guard glob is
`docs-*.test.ts` in `.claude/mcp/vice/`, and the gate's own proof test is named
e.g. `docs-audit-integrity.test.ts`, then a real-repo invocation of the gate
(Layer 1's clean-checkout test, or the hook, or CI) spawns `node --test` over a
file set that includes the gate's own test file — which itself, when run,
re-invokes the gate, which re-spawns the same set, recursively.
**Why it happens:** The guard-set glob and the gate's proof-test location are
easy to conflate as "the same family of file."
**How to avoid:** D-12-09 already names this — `audit-integrity.test.ts`, no
`docs-` prefix. Verified: this file will NOT be picked up by
`readdirSync(viceDir).filter(f => /^docs-.*\.test\.ts$/.test(f))` under any
naming scheme that avoids the `docs-` prefix.
**Warning signs:** A real-repo (non-synthetic-tree) run of `audit-integrity.test.ts`
that takes meaningfully longer than ~215ms, or that never terminates, is this
failure mode.

### Pitfall 4: Committing absolute machine-specific paths into `.claude/settings.json`
**What goes wrong:** The CURRENT (uncommitted, gitignored) repo-local
`.claude/settings.json` — read directly for this research — contains three
`additionalDirectories` entries with absolute paths under this machine's own
home directory (`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-*`)
and ~30 `permissions.allow` entries, several referencing absolute paths and
one-off `sed`/`cp` commands from earlier debugging sessions. None of this
belongs in the committed, hooks-only file D-12-05 describes.
**Why it happens:** Claude Code itself writes session-approved permissions
into whichever `settings.json` is "closest" unless the user is careful about
which file is active when approving a prompt.
**How to avoid:** The committed `.claude/settings.json` must contain ONLY a
`hooks` key. Move the entire current `permissions` block (including
`additionalDirectories`) into `.claude/settings.local.json` — verified
separately gitignored via `/home/henrik/.config/git/ignore:1`
(`**/.claude/settings.local.json`), NOT via the project's own `.gitignore`.
**Warning signs:** `git diff --cached .claude/settings.json` showing anything
other than a `hooks` key is a redline before commit.

### Pitfall 5: Fail-open vs. fail-closed on the hook's own internal errors
**What goes wrong:** Every existing advisory hook on this machine
(`gsd-prompt-guard.js`, `gsd-read-guard.js`, `gsd-workflow-guard.js`) follows a
"silent fail — never block tool execution" convention: `catch { process.exit(0); }`.
That convention is correct for advisory hooks but directly contradicts D-12-14's
"no override hatch, the gate is absolute" premise if copied verbatim — a hook
that fails open on a JSON-parse error, a `spawnSync` ENOENT, or an unreadable
`.planning/` directory silently becomes exactly the undocumented escape hatch
D-12-14 exists to prevent.
**Why it happens:** The house style optimizes for "never block the user's
unrelated work by accident," which is right for advisory hooks and wrong for a
gate whose entire purpose is to block on purpose.
**How to avoid:** This is a real design decision left open by CONTEXT.md's
Discretion section (not resolved by any `D-12-*`) — the planner must choose
explicitly and record the choice: fail-open (safer against a bug in the hook
itself bricking all Write/Edit/Bash) vs. fail-closed (consistent with "no
override hatch," but a bug in `audit-gate.mjs` becomes a total repo-wide
write-block). Recommendation: fail-closed **only for the narrow matcher scope**
(paths/commands matching `*MILESTONE-AUDIT*.md` shapes) so a hook bug cannot
brick unrelated work, while still being absolute for the one write class
GATE-01 cares about.

## Code Examples

### Guard-set derivation with a floor (adapt directly)
```typescript
// Source: .claude/mcp/vice/hostpath-consumers.test.ts (readdirSync + floor
// pattern, D-12-07/D-12-08's direct precedent)
const allModules = readdirSync(HERE).filter((f) => /\.(ts|mts)$/.test(f) && !f.endsWith(".test.ts"));
// ... then assert allModules.length >= <floor> AND the known names are present
```

### Spawning `node --test` over a computed file set (adapt, but capture output)
```javascript
// Source: .claude/mcp/vice/test-gate.mjs:90-98 — REUSE THE SHAPE, not the
// stdio choice. audit-gate.mjs needs captured text for D-12-15's message:
function runGuardsLive(viceDir, files) {
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: viceDir,
    encoding: "utf8", // NOT stdio: "inherit" — the gate must read the TAP output
  });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}
```

### Building a synthetic multi-file tree for the planted-violation test
```typescript
// Source: .claude/mcp/vice/install-resources.test.ts (mkdtempSync pattern,
// the established way to build a disposable multi-file tree in this repo)
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "audit-gate-planted-"));
const viceDir = join(root, ".claude", "mcp", "vice");
const planningDir = join(root, ".planning");
mkdirSync(viceDir, { recursive: true });
mkdirSync(planningDir, { recursive: true });
writeFileSync(join(viceDir, "docs-fake-guard.test.ts"),
  `import { test } from "node:test"; import assert from "node:assert/strict";\n` +
  `test("planted red", () => { assert.equal(1, 2); });\n`);
writeFileSync(join(planningDir, "v9.9.9-MILESTONE-AUDIT.md"),
  `---\nmilestone: v9.9.9\nstatus: passed\n---\n# synthetic\n`);
// ... call checkAuditGate({ viceDir, planningDir }) and assert refusal, then
// rmSync(root, { recursive: true, force: true }) in `after()`.
```

### Nested `node --test` invocation — empirically verified working (this session)
```
$ node --version
v22.22.0
$ node --test outer.test.mjs   # outer.test.mjs spawnSync()s `node --test inner.test.mjs`
TAP version 13
ok 1 - outer spawns node --test on inner.test.mjs and observes its exit code
# tests 1 / pass 1 / fail 0
exit code: 0
```
Confirms D-12-16's "committed test calls the script, which spawns `node
--test`" shape does not hit any Node test-runner reentrancy issue on this host.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Milestone close checklist item ("run the four docs guards before recording status") | Mechanically-enforced `PreToolUse` block + committed clean-checkout test | This phase (2026-08-21) | Closes the exact hole `4f048bb` demonstrated: a checklist step nobody executed |
| `exit 2` + `hookSpecificOutput.permissionDecision` combined (some published hook examples online use this) | `exit 2` alone, reason on stderr, JSON output (if any) treated as non-authoritative for blocking | Documented as current behavior; a filed upstream issue confirms the combined form is unreliable | Any hook design copied from an older blog post/example using the combined form should be re-verified against this host's actual behavior before trusting it |

**Deprecated/outdated:** None specific to this phase's domain — `node:test` and
`PreToolUse` hooks are both current, actively-maintained surfaces on this host.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Code's `Write` tool's `tool_input` shape is `{ file_path, content, description }` and `Edit`'s is `{ file_path, old_string, new_string, replace_all }` (empirically observed field names: `content`, `new_string`) — NOT the `{ file_text }` / `{ edits: [{old_text,new_text}] }` shape a WebFetch of the official hooks doc page returned | PreToolUse hook contract | If the WebFetch-reported shape is actually correct for some other Claude Code build/version, `audit-gate.mjs`'s hook-mode stdin parsing reads the wrong field and silently never fires (fails open) — HIGH severity, since this directly defeats D-12-03. **Must be resolved empirically** (a diagnostic hook dumping raw stdin JSON to a scratch file) before trusting either source, since the two disagree and only one can be right for this host's actual Claude Code 2.1.238 |
| A2 | A subagent's (Task-tool-spawned) own `Write`/`Edit`/`Bash` calls also route through the parent session's project-scoped `PreToolUse` hooks, not just the main session's own tool calls | Layer 2 coverage | If subagent tool calls bypass project hooks, a GSD workflow that delegates the actual audit-file write to a subagent would slip past Layer 2 entirely, leaving only Layer 1 (still a real backstop, but D-12-03's "refuses the write itself" framing would only be true for main-session writes) |
| A3 | `tool_input.command` for the `Bash` tool always contains the FULL command string as typed/generated, including the entire body of a heredoc (`cat > f <<EOF ... EOF`), not a truncated or first-line-only view | Bash-heredoc detection (D-12-04) | If truncated, the hook's Bash-matcher scan could miss a heredoc payload landing past a truncation point — MEDIUM severity, mitigated by Layer 1 always catching it on the next `npm test`/CI run regardless |

**None of the above block planning** — A1 and A3 are cheap to resolve with a
five-line diagnostic hook script during implementation (write raw stdin to a
scratch file, trigger one Write and one Bash-heredoc call, inspect); A2 is
resolved for free by D-12-17's real-tree plant-and-revert transcript, which
should explicitly note which session context (main vs. subagent) performed the
write.

## Open Questions

1. **Fail-open vs. fail-closed on the hook's own internal errors (Pitfall 5).**
   - What we know: every existing advisory hook on this host fails open; D-12-14
     wants an absolute gate with no hatch.
   - What's unclear: whether "absolute" was meant to extend to the hook's own
     bugs, or only to the documented human bypasses (waiver files, env vars)
     D-12-14 explicitly names.
   - Recommendation: fail-closed, but scoped narrowly to the `*MILESTONE-AUDIT*.md`
     write shape specifically, so a bug in `audit-gate.mjs` cannot brick
     unrelated Write/Edit/Bash calls repo-wide. Record this scoping choice
     explicitly in the phase SUMMARY, as CONTEXT.md already asks for D-12-12's
     stricter-than-`GATE-01` scope decision.

2. **Exact stdin field names for Write/Edit tool_input on this Claude Code build (A1 above).**
   - What we know: two disagreeing sources (empirical local hook scripts vs. a
     WebFetch of the hosted docs).
   - What's unclear: which is authoritative for Claude Code 2.1.238 specifically.
   - Recommendation: resolve empirically at implementation time with a
     five-line diagnostic hook before writing `audit-gate.mjs`'s stdin-parsing
     logic; do not guess from either source alone.

3. **Where exactly the hook shells `audit-gate.mjs` from (thin wrapper vs. direct).**
   - What we know: CONTEXT.md leaves this to planner discretion; `command`
     in a hook entry is a plain shell string (see the working examples in
     `~/.claude/hooks/*` and this host's own `.claude/settings.json`, e.g.
     `bash "/home/henrik/.claude/hooks/gsd-phase-boundary.sh"`).
   - What's unclear: whether `node scripts/audit-gate.mjs --hook` (self-detecting
     hook mode by an argv flag) or a separate one-line wrapper script reads
     better given this repo's "no build step, `.mjs` shebang" convention.
   - Recommendation: a single script with an argv-flag-selected mode (`--hook`
     reads stdin JSON; no flag/other args = Layer-1/CLI mode against a given
     root) keeps D-12-01's "exactly one place the logic lives" property
     tightest — a wrapper script would be a second file that could drift.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node:test`, `scripts/audit-gate.mjs` | ✓ | v22.22.0 (repo floor `>=22.18.0`) | — |
| Claude Code CLI (hooks support) | Layer 2 (`PreToolUse`) | ✓ | 2.1.238 | — |
| git | Layer 1's repo-root resolution, plant-and-revert transcript | ✓ | (repo already a git worktree) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — this phase has no external
service or tool dependency beyond what the repo already requires.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (no separate framework) |
| Config file | none — `.claude/mcp/vice/package.json:106` (`"test": "node --test '*.test.*'"`) |
| Quick run command | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` |
| Full suite command | `cd .claude/mcp/vice && npm test` (bare `node --test '*.test.*'`, the command CI's `Test` step actually runs — `ci.yml:110-122`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-01 (criterion 3: check point is code, not a checklist) | `scripts/audit-gate.mjs` exists and is imported/called by a committed test | unit | `node --test audit-integrity.test.ts -t "planted violation"` | ❌ Wave 0 — file does not exist yet |
| GATE-01 (criterion 1: a red guard blocks) | Synthetic tree with a failing guard + gated-status audit → `checkAuditGate()` refuses | unit (planted-violation) | `node --test audit-integrity.test.ts -t "planted violation"` | ❌ Wave 0 |
| GATE-01 (criterion 2: all-green allows) | Synthetic tree with a passing guard + gated-status audit → `checkAuditGate()` allows | unit (planted false-negative) | `node --test audit-integrity.test.ts -t "planted false-negative"` | ❌ Wave 0 |
| GATE-01 (criterion 1/2, real-tree evidence) | Plant-and-revert against the real repo (D-12-17..20) | manual, evidenced by a committed transcript | `node scripts/audit-gate.mjs` run twice (red, then reverted-green), output captured | N/A — this is a one-time recorded transcript, not an automated test |
| D-12-03/D-12-04 (hook refuses the write in-session) | A real `Write`/`Edit`/`Bash` call attempting to record a gated status while a guard is red | manual, evidenced by transcript | Trigger via an actual tool call inside a live session with `.claude/settings.json` wired, observe `exit 2` block | N/A — hook behavior cannot be unit-tested the way Layer 1 can (`vice-sync.ts`'s precedent: some invariants only mean something against the real runtime) |

### Sampling Rate
- **Per task commit:** `node --test audit-integrity.test.ts` (fast — the four
  real guards plus a synthetic-tree pair, well under 1s per the measured
  0.215s baseline for the four guards alone)
- **Per wave merge:** `npm test` (full `.claude/mcp/vice` suite)
- **Phase gate:** Full suite green (`npm test`) before `/gsd-verify-work`, PLUS
  the one-time plant-and-revert transcript committed as a phase artifact
  (D-12-19/D-12-20) — this phase's success criteria 1 and 2 are NOT satisfied
  by the automated test suite alone; they require the recorded real-tree
  evidence.

### Wave 0 Gaps
- [ ] `scripts/audit-gate.mjs` — does not exist yet; the single check point
- [ ] `.claude/mcp/vice/audit-integrity.test.ts` — does not exist yet; Layer 1
- [ ] `.claude/settings.json` amendment (hooks-only, committed) — currently
  exists locally but is fully gitignored and contains only `permissions`
- [ ] `.claude/settings.local.json` amendment (receives the moved
  `permissions` block) — already exists with unrelated content
  (`disabledMcpjsonServers: ["mastra", "vice"]`, four `permissions.allow`
  entries) that must be preserved, not overwritten
- [ ] `.gitignore:51-55` comment amendment recording the split rationale (no
  functional test gap, but part of the phase's documentation obligation)

*Framework install: none needed — `node:test` is already the repo's test
runner.*

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase has no auth surface |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | `scripts/audit-gate.mjs` parses untrusted-shaped input (hook stdin JSON, Markdown/YAML frontmatter text, Bash command strings) — must `JSON.parse()` defensively (catch, never assume shape), and must NEVER `eval()`/`exec()`/dynamically `import()` any scanned text. This matches the established repo-wide convention already stated verbatim in `scripts/check-skill-tool-coverage.mjs`'s own header: "never import()s, require()s, eval()s or spawns anything from [untrusted content] — skill content remains untrusted input that is matched, never executed." Apply the identical discipline to hook stdin and scanned Bash command strings. |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hook script crashes/hangs on malformed or adversarial stdin JSON (e.g. deeply nested object, huge string), stalling every tool call in the session | Denial of Service | Wrap `JSON.parse` in try/catch with a fail path decided per Open Question 1; set an explicit stdin-read timeout (existing local hooks use a 3-5s `setTimeout` guard, e.g. `gsd-prompt-guard.js:36`) so a hung stdin read cannot block the session indefinitely |
| A crafted Bash command string designed to evade the heredoc/`>>`/`tee` regex scan (e.g. base64-encoded payload piped through `base64 -d`, or a Python one-liner writing the file) still lands a gated status | Tampering | Explicitly out of scope for a regex-based Layer 2 — this is exactly why D-12-04 frames the hook as a partial backstop and Layer 1 (which re-scans the ACTUAL FILE CONTENT after any write, regardless of how it was written) as the real, unevadable enforcement point. Document this limitation plainly in the phase SUMMARY rather than implying the hook is bulletproof. |
| `spawnSync(process.execPath, ["--test", ...files])` called with a file list built from untrusted input | Tampering / Elevation of Privilege | Not a real risk here — the file list always comes from `readdirSync()` over a fixed, code-controlled directory (`.claude/mcp/vice/` in production; a `mkdtempSync`-built path only in tests), never from hook stdin or any user-controlled string. Preserve this invariant: never let the guard-file list itself be influenced by the write being evaluated. |

## Sources

### Primary (HIGH confidence — verified directly against this host/repo)
- `.claude/mcp/vice/test-gate.mjs` (spawn-and-interpret shape, `MANUAL_ONLY_TESTS`)
- `.claude/mcp/vice/test-gate.test.ts` (drift-guard shape for a derived set)
- `.claude/mcp/vice/hostpath-consumers.test.ts` (readdirSync-derived-set-plus-floor)
- `.claude/mcp/vice/docs-review-disposition.test.ts` (planted-violation pair convention, `extractTechDebtBlock` column-zero technique, lines 159-183/291/319)
- `.claude/mcp/vice/docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`, `docs-deferred-ledger.test.ts` (the four guards themselves, read in full/head)
- `.claude/mcp/vice/install-resources.test.ts` (`mkdtempSync` synthetic-tree pattern)
- `scripts/check-skill-tool-coverage.mjs` (never-eval/import untrusted content convention; non-vacuity floor style)
- `scripts/check-npm-packages.mjs` (test-file and `scripts/` tarball-exclusion assertions, lines ~50-71)
- `scripts/package.sh` (plugin zip = `git archive HEAD`, discovered during this research, not previously documented in CONTEXT.md)
- `.github/workflows/ci.yml:110-122` (the `Test` step, bare `npm test`)
- `.claude/mcp/vice/package.json:105-112` (`test`/`test:automated`/`test:manual` scripts)
- `.gitignore:51-55` (existing `.claude/settings.json` ignore + rationale comment)
- `.planning/milestones/v0.2.0-MILESTONE-AUDIT.md`, `v0.3.0-MILESTONE-AUDIT.md` (exact frontmatter shape AND the false-positive-risk prose occurrences of `status:`)
- `~/.claude/settings.json` (this machine's own real, working `PreToolUse`/`PostToolUse` hook wiring — the matcher syntax and JSON shapes cited throughout are read directly from this file, not documentation)
- `~/.claude/hooks/gsd-prompt-guard.js`, `gsd-read-guard.js`, `gsd-workflow-guard.js`, `gsd-validate-commit.sh` (real, working hook implementations — stdin JSON field names, exit-code usage, `hookSpecificOutput` shape all read directly from these)
- `$HOME/.claude/get-shit-done/workflows/audit-milestone.md` §6 (confirms the live write target is `.planning/v{version}-MILESTONE-AUDIT.md`, top-level, matching `docs-review-disposition.test.ts`'s existing scan scope)
- Live command output, this session: `time node --test docs-*.test.ts` (0.215s, 19 tests, 0 fail); a disposable nested `node --test` spawn test (exit 0); a disposable planted-red test (TAP failure output shape, exit 1); `git check-ignore -v` on both settings files; `grep -c "status:"` on both milestone audit files

### Secondary (MEDIUM confidence)
- WebFetch of `https://code.claude.com/docs/en/hooks` — corroborates exit-code semantics (0/2), matcher syntax (`|`-separated exact names or unanchored regex), and the settings-file merge/precedence hierarchy. **Diverges from empirical evidence** on the exact `tool_input` field names for `Write`/`Edit` (see Assumption A1) — treat the field-name portion as unverified for this host's specific build.
- `anthropics/claude-code#43407` (GitHub issue, found via WebSearch, corroborated by the official docs' own "exit 2 blocks whether or not you print JSON" wording) — the exit-2-plus-`permissionDecision` unreliability.

### Tertiary (LOW confidence)
- None relied upon for a load-bearing claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every primitive (`node:test`,
  `spawnSync`, `PreToolUse`) already has a working precedent on this exact host
- Architecture: HIGH — the parameterized-function pattern is a direct copy of
  `test-gate.mjs`'s own shape, already proven in this codebase
- Pitfalls: HIGH for the frontmatter false-positive risk (measured directly:
  9 and 4 `status:` occurrences respectively, only 1 each in frontmatter);
  MEDIUM for the hook exit-code/JSON interaction (corroborated by official docs
  plus a filed upstream issue, not independently reproduced in this session)

**Research date:** 2026-08-21
**Valid until:** 30 days for the Node/`node:test`/repo-structure claims
(stable); 7 days for the Claude Code hooks-contract claims specifically (fast-
moving platform surface, and this research already found one live
docs-vs-empirical-behavior discrepancy — re-verify if the Claude Code version
changes before implementation)
