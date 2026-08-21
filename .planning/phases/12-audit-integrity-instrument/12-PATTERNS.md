# Phase 12: Audit Integrity Instrument - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 6 (5 new, 1 modified)
**Analogs found:** 6 / 6 (one is a partial/no-direct-analog case, noted below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/audit-gate.mjs` | utility / CI gate script | batch (spawn subprocess, interpret exit code) | `.claude/mcp/vice/test-gate.mjs` | exact (spawn/interpret shape) + `scripts/check-skill-tool-coverage.mjs` (need()/errors[]/report shape) |
| `.claude/mcp/vice/audit-integrity.test.ts` | test | transform (derive set from disk + assert) | `.claude/mcp/vice/hostpath-consumers.test.ts` (derived-set+floor) and `.claude/mcp/vice/docs-review-disposition.test.ts` (planted-violation/false-negative pair) | exact (composite of two analogs) |
| `.claude/settings.json` (hooks-only) | config | event-driven (PreToolUse hook wiring) | `.claude-plugin/plugin.json` (`hooks.SessionStart` block) | role-match (only committed hook-declaration precedent in repo; no PreToolUse precedent exists) |
| `.claude/settings.local.json` | config | N/A (static permissions) | itself, already exists on disk (gitignored via **global** git ignore, not repo `.gitignore`) — no repo analog needed, just relocate content | n/a — file already exists, verify then leave as-is |
| `.gitignore` (amend `:51-55`) | config | N/A | itself — amend in place, same comment style as the block being edited | exact (self-analog) |
| `.planning/phases/12-.../12-GATE-PROOF.md` (or similar) | test/proof artifact | batch (recorded transcript) | `.planning/phases/08.1-.../08.1-WALKTHROUGH-EVIDENCE.md` | exact |

## Pattern Assignments

### `scripts/audit-gate.mjs` (utility / CI gate script, batch)

**Primary analog:** `.claude/mcp/vice/test-gate.mjs` (spawn/interpret shape)
**Secondary analog:** `scripts/check-skill-tool-coverage.mjs` (header convention, `need()`/`errors[]` accumulation, exit-code + report-to-stdout shape)

**Shebang + header-comment convention** (`test-gate.mjs:1-27`, mirrored in `check-skill-tool-coverage.mjs:1-43`):
```javascript
#!/usr/bin/env node
// The ONE place naming which .claude/mcp/vice test files are manual-only
// versus safe for the automated regression gate (`npm run test:automated`).
//
// WHY THIS FILE EXISTS: <the dated incident / defect that motivated it, with
// a link to the todo/finding that dispositioned it>
//
// WHAT NOT TO DO: do not re-list these seven file names in a CI workflow, an
// npm script, or a second test runner anywhere else in this repo. If an
// eighth file needs the same treatment, add it to MANUAL_ONLY_TESTS below and
// nowhere else -- test-gate.test.ts's drift guard fails the build if a test
// file ever escapes both this list and the automated set, ...
```
For `audit-gate.mjs`, the header must name `4f048bb` / the v0.3.0 close, per CONTEXT.md's Established Patterns note, and state the "single seam" rule (D-12-01): every enforcement layer calls this script; the logic exists in exactly one place.

**Guard-set derivation (glob-from-disk-plus-floor)** — reuse this shape from `test-gate.mjs:82-88`:
```javascript
import { readdirSync } from "node:fs";

/** Every `*.test.*` entry in `dir`, sorted, with every MANUAL_ONLY_TESTS
 * member removed. This -- not a second glob anywhere else -- is exactly what
 * `npm run test:automated` runs. */
export function automatedTestFiles(dir) {
  const all = readdirSync(dir).filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f));
  return all.filter((f) => !MANUAL_ONLY_TESTS.includes(f)).sort();
}
```
`audit-gate.mjs`'s equivalent (per D-12-07) globs `docs-*.test.ts` in `.claude/mcp/vice/` instead of subtracting a manual-only list:
```javascript
export function docsGuardFiles(dir) {
  const files = readdirSync(dir).filter((f) => /^docs-.*\.test\.ts$/.test(f)).sort();
  return files;
}
export const DOCS_GUARD_FLOOR = 4;
export const EXPECTED_DOCS_GUARD_NAMES = [
  "docs-linerefs.test.ts",
  "docs-dangling-refs.test.ts",
  "docs-deferred-ledger.test.ts",
  "docs-review-disposition.test.ts",
];
```
(D-12-08's floor-assertion shape is identical to `hostpath-consumers.test.ts:182-197`'s `R2000_MODULE_FLOOR` pattern — see below.)

**Spawn + interpret exit code** — reuse verbatim from `test-gate.mjs:90-98`:
```javascript
import { spawnSync } from "node:child_process";

/** Spawn `node --test <files>` with stdio inherited so the child's own TAP
 * output reaches the caller directly, and return its exit code. Always an
 * argv array -- never a shell string -- so a file name can never be
 * interpreted by a shell. */
function runNodeTest(files) {
  const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
```
D-12-11 constrains this: invoke the four guard files directly (`node --test docs-*.test.ts`), never `npm test`/`npm run test:automated` — so `audit-gate.mjs` calls `runNodeTest(docsGuardFiles(viceDir))` with `cwd` set to `.claude/mcp/vice`, not `test-gate.mjs`'s own `MANUAL_ONLY_TESTS`-subtraction path.

**`need()`/`errors[]` accumulation + exit-code + report contract** — reuse from `check-skill-tool-coverage.mjs:56-59` and its report block at `:520-548`:
```javascript
const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};
// ... assertions via need(cond, message) ...
if (errors.length) {
  console.error("check-skill-tool-coverage: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`check-skill-tool-coverage: OK -- ...`);
```
Per D-12-15, `audit-gate.mjs`'s failure message must name (a) which guard is red, (b) its failing assertion text (the guard's own subprocess output, inherited stdio already gives this for free), and (c) the two legitimate routes (fix the guard's target docs, or change/retire the guard in a commit — no waiver). Model the message wording on `check-skill-tool-coverage.mjs`'s `need(false, ...)` calls, e.g. line 395-399's "Resolve by: (1) ..., (2) ..., (3) ..." enumerated-route style.

**Milestone-audit-status parsing** — no direct analog exists for parsing YAML frontmatter `status:` out of a `*MILESTONE-AUDIT*.md`; the closest structural precedent is `docs-review-disposition.test.ts`'s `extractTechDebtBlock()` (`docs-review-disposition.test.ts:159-183`), which does a **column-zero line-scan** rather than a regex-lookahead, because a lookahead anchored on bare `$` under `/m` matches every line-end and silently truncates the block. Reuse that line-scan discipline for extracting `status:` (a single top-level YAML key, easier than `tech_debt:`'s multi-line block, but the same "column-zero key" boundary applies):
```javascript
// docs-review-disposition.test.ts:171-183, adapt for a single-line key:
function extractFrontmatterValue(md, key) {
  const lines = md.split("\n");
  const line = lines.find((l) => l.startsWith(`${key}:`));
  return line ? line.slice(key.length + 1).trim() : null;
}
```
Gated statuses (D-12-12/D-12-13): `passed` and `tech_debt` are gated; `gaps_found` is never gated. Discover `*MILESTONE-AUDIT*.md` files under `.planning/` per the CONTEXT.md discretion note (exact glob root left to the planner) — `docs-review-disposition.test.ts:149-157`'s `topLevelMilestoneAuditFiles()` is the precedent for a **top-level-only** glob (`.planning/v*-MILESTONE-AUDIT.md`, never `.planning/milestones/**`) if the planner chooses that root; note CONTEXT.md's live files are actually under `.planning/milestones/` now (`v0.3.0-MILESTONE-AUDIT.md`, `v0.2.0-MILESTONE-AUDIT.md`), so verify the real current path before committing to a root.

---

### `.claude/mcp/vice/audit-integrity.test.ts` (test, transform)

**Analog 1 — derived-set-plus-floor:** `.claude/mcp/vice/hostpath-consumers.test.ts:182-197` (see full excerpt above under `docs-guardFiles`). Copy this shape directly for D-12-07/D-12-08:
```typescript
// hostpath-consumers.test.ts:182-197
const R2000_MODULE_FLOOR = 14;

test("the r2000 module family (D-08/R2000-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)", () => {
  const modules = r2000ProductionModules();
  assert.ok(
    modules.length >= R2000_MODULE_FLOOR,
    `expected >= ${R2000_MODULE_FLOOR} r2000-*.ts production modules on disk, found ${modules.length} -- ` +
      "an empty or broken glob must fail loudly here rather than let the absence assertion below pass trivially",
  );
});
```
Adapt to: `>= 4` docs guards found on disk, plus a `deepEqual`-style presence assertion for the four named guards (`docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`, `docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts`), mirroring `test-gate.test.ts:16-29`'s exact-membership test:
```typescript
// test-gate.test.ts:16-29
test("gate: MANUAL_ONLY_TESTS contains exactly the seven dispositioned files", () => {
  assert.deepEqual(
    [...MANUAL_ONLY_TESTS].sort(),
    [ /* ... */ ].sort(),
  );
});
```

**Analog 2 — planted-violation / planted-false-negative pair:** `.claude/mcp/vice/docs-review-disposition.test.ts:291-334` (and the fixture files it reads, `.claude/mcp/vice/fixtures/planted-review-fixture.md` / `planted-disposition-fixture.md`). This is the exact template D-12-16 cites:
```typescript
// docs-review-disposition.test.ts:291-317, structure to copy
test("planted violation: a synthetic finding id mentioned nowhere is reported undispositioned", () => {
  // ... exercise the real predicate against synthetic input that must fail ...
  assert.equal(isDispositioned("WR-99", realPhaseDispositionText), false, "...");
});

test("planted false-negative: the same synthetic id WITH a disposition source present is reported dispositioned", () => {
  // Pins that the guard reads disposition SOURCES, not merely counts
  // headings -- a checker that always returned "undispositioned" would
  // pass the previous test but fail this one.
  assert.equal(isDispositioned("WR-99", dispositionText), true, "...");
});
```
For `audit-integrity.test.ts`, D-12-16 requires: build a **synthetic tree** with a deliberately-red guard file plus a synthetic audit declaring `status: passed`, and assert the gate refuses; then its green mirror (synthetic audit, all guards green -> allowed). Since `audit-gate.mjs` re-runs guards live in a subprocess (D-12-10) rather than reading fixture text, the synthetic tree needs real files on disk under a temp directory — no existing test in this repo builds an actual temp directory tree and spawns a subprocess against it; the closest structural precedent for "write real files to a scratch location, then assert against them" is `hostpath-consumers.test.ts`'s `fixtures/` pattern (real committed fixture files, not a runtime-constructed temp tree) and `docs-review-disposition.test.ts`'s two committed fixture files under `.claude/mcp/vice/fixtures/`. **Recommendation:** follow the committed-fixture convention (a `fixtures/planted-red-guard.test.ts`-shaped fixture plus a `fixtures/planted-audit-passed.md`) rather than `node:fs.mkdtempSync` at test run time, since that is the established idiom in this exact directory and keeps the planted case inspectable in the diff.

**`node:test` + `node:assert/strict` idiom, HERE/ROOT resolution** — copy verbatim from `docs-linerefs.test.ts:22-30` / `docs-review-disposition.test.ts:52-62`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
```

**D-12-09 correctness constraint:** name this file `audit-integrity.test.ts`, never `docs-audit-integrity.test.ts` — a `docs-`-prefixed name makes `docsGuardFiles()` glob-match this very file and spawn it recursively inside its own subprocess call.

---

### `.claude/settings.json` (hooks-only, config)

**Analog:** `.claude-plugin/plugin.json:24-35` — the only committed hook declaration in this repo:
```json
"hooks": {
  "SessionStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/ensure-mcp-deps.sh\""
        }
      ]
    }
  ]
}
```
No `PreToolUse` precedent exists anywhere in this repo (confirmed via repo-wide grep — the only hits are this phase's own planning docs). The shape above is the closest structural precedent for "declare a hook block, point `command` at a repo-relative script." For `PreToolUse`, Claude Code's own schema (external, not in this repo) adds a `matcher` field selecting tool names; D-12-04 requires the matcher cover `Write`, `Edit`, **and `Bash`** (the heredoc-bypass case). Model:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs\" --hook" }
        ]
      }
    ]
  }
}
```
(exact CLI contract — flag name, stdin vs argv — is explicitly left to the planner per CONTEXT.md's discretion note). Since `PreToolUse` runs pre-permission and `exit 2` blocks unconditionally regardless of mode (CONTEXT.md `<specifics>`), the script's hook-mode exit code contract must return `2` on refusal — verify this against Claude Code's actual `PreToolUse` exit-code contract before finalizing (external reference: `~/.claude/get-shit-done/workflows/audit-milestone.md` is read-only and does not define hook schema).

**Split rationale (D-12-05), directly from the codebase's own current state (live-verified this session):**
```
$ git check-ignore -v .claude/settings.local.json .claude/settings.json
/home/henrik/.config/git/ignore:1:**/.claude/settings.local.json	.claude/settings.local.json
.gitignore:55:/.claude/settings.json	.claude/settings.json
```
`.claude/settings.json` already exists on disk, ignored by the repo's own `.gitignore:55`, and currently holds a `permissions.allow` array containing absolute worktree paths (e.g. `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-ac6364419df54f1fb/...`) — this is the exact machine-specific content D-12-05 says must move to `.claude/settings.local.json`, which is *already* separately ignored via the user's **global** git ignore file (`~/.config/git/ignore`), not this repo's `.gitignore` — confirming D-12-05's claim that the split "stays ignored" needs no new repo-level ignore rule for `settings.local.json`. `.claude/settings.local.json` already exists too, currently holding `disabledMcpjsonServers` and a small permissions block. The task is: move the current `.claude/settings.json`'s `permissions.allow`/`additionalDirectories` content into `.claude/settings.local.json` (merging with what's already there), then overwrite `.claude/settings.json` with a hooks-only object, then `git add -f .claude/settings.json` (it's currently gitignored, so a plain `git add` will silently no-op — confirm the amended `.gitignore` change lands in the same commit/before staging, or use `-f`).

---

### `.gitignore` amendment (`:51-55`)

**Analog:** itself, in place. Current text to amend:
```
# Local Claude Code permission/allowlist config. Currently holds absolute
# worktree paths from earlier sessions, so it is machine-specific and must
# not be committed; the shared plugin config lives in .mcp.json /
# .claude-plugin/ instead.
/.claude/settings.json
```
Per D-12-05, amend the comment to record the split and why, and adjust the ignored path from `/.claude/settings.json` (the whole file) to `/.claude/settings.local.json` (the machine-specific half only) — `.claude/settings.json` itself must stop being ignored so it can be committed hooks-only. Style: this repo's `.gitignore` comment blocks consistently explain WHY a path is ignored and point at the alternative location, matching every other block in the file (see `/tools/` block at `:16-24`, `/installer/skills/` block at `:40-44`). Follow that voice exactly — do not shorten to a bare path with no comment.

---

### `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md` (proof artifact)

**Analog:** `.planning/phases/08.1-close-v0-2-0-audit-items-uat-walkthrough-planning-doc-drift/08.1-WALKTHROUGH-EVIDENCE.md`

**Frontmatter + structure** (`08.1-WALKTHROUGH-EVIDENCE.md:1-26`):
```markdown
---
outcome: fail
driving_rung: headless-claude-p
backend_reported: stock
tested_artifact_sha: 0e6e913e493216579a8a6a680d5e84b9729fd320
driven_by: agent-proxy
date: 2026-08-19
---

# Phase 08.1 Plan 04 — Walkthrough Evidence

This document is the literal transcript and outcome of the one criterion-1 UAT walkthrough
that had never been run: ...
```
Adapt frontmatter fields to this phase's shape, e.g. `outcome: red-then-green`, `planted_change: CLAUDE.md vice-proxy.ts:<N> citation digit`, `guard: docs-linerefs.test.ts`, `date: 2026-08-21`, `reverted: true`. The body must show, verbatim, both halves per D-12-20:
1. The plant (one-character CLAUDE.md edit per D-12-18), the guard command invoked, and its red output.
2. The revert (the one-character undo) and the guard's own green output re-run afterwards — "as explicit as the plant," not merely asserted.

Style precedent for showing real command transcripts inline (`08.1-WALKTHROUGH-EVIDENCE.md:36-43`, `:70-74`):
```
$ cd /tmp/gsd-08.1-walkthrough/scratch-project && timeout 60 claude -p ...
mcp__vice__vice_autostart
... (37 tools total, full vice_* stock surface)
```
Use the same fenced-command / literal-output convention for the gate's red run, the `audit-gate.mjs` refusal message (proving D-12-15's message content), and the green re-run after revert. Per D-12-19, place this file directly in `.planning/phases/12-audit-integrity-instrument/`, not under `docs/` (which is reserved for durable cross-milestone findings like `docs/phase0-binmon-findings.md`).

## Shared Patterns

### Header-comment convention (every new file must carry one)
**Source:** universal in this repo — see `.claude/mcp/vice/test-gate.mjs:1-65`, `.claude/mcp/vice/docs-review-disposition.test.ts:1-51`, `.claude/mcp/vice/docs-linerefs.test.ts:1-21`, `scripts/check-skill-tool-coverage.mjs:1-43`.
**Apply to:** `scripts/audit-gate.mjs`, `.claude/mcp/vice/audit-integrity.test.ts`.
Shape: a `// <filename>` line (optional but common), then a `WHY THIS EXISTS:` (or `WHY THIS FILE EXISTS:`) paragraph naming the **dated incident** that motivated the file — here, `4f048bb`'s v0.3.0 close with a red guard and nothing stopping it — followed by a `WHAT NOT TO DO:` paragraph naming the specific past mistake (a second competing list, a second hand-typed check, a bypass hatch) and often a `SCOPE FENCE:` paragraph stating what the file deliberately does NOT do. Example excerpt (`docs-review-disposition.test.ts:1-21`):
```
// docs-review-disposition.test.ts
//
// WHY THIS EXISTS: AUDIT-01's own defect, applied to itself. The v0.3.0
// audit's AUDIT-01 finding was not "these four warnings are wrong" -- it was
// "these four warnings have no disposition anywhere." ...
//
// SCOPE FENCE: this guard reports; it does not rewrite, and it does not
// require any PARTICULAR disposition wording -- only that the finding id is
// mentioned in at least one recognised disposition source. A guard that
// demanded specific phrasing would fight every future reviewer's prose and
// get switched off.
```

### Node built-in test runner, no new dependencies
**Source:** every `*.test.ts` in `.claude/mcp/vice/` (`docs-linerefs.test.ts:22-23`, `hostpath-consumers.test.ts:24-25`).
**Apply to:** `audit-integrity.test.ts`.
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
```
No test framework dependency; `npm test` runs `node --test '*.test.*'` (`.claude/mcp/vice/package.json:106`).

### `docs-*.test.ts` excluded from published tarballs
**Source:** `scripts/check-npm-packages.mjs:59-61` (generic `*.test.*` exclusion, applies to any test file regardless of name), confirmed by `docs-linerefs.test.ts:18-21`'s own comment ("deliberately kept OUT of package.json's files[]").
**Apply to:** `audit-integrity.test.ts` (automatically excluded — it matches `\.test\.ts$`, no files[] edit needed) and `scripts/audit-gate.mjs` (lives under `scripts/`, outside both packages' `files[]` roots entirely — verify this by checking `.claude/mcp/vice/package.json`'s own `files` array does not reach up to `../../scripts/`, which it structurally cannot since npm pack roots at the package dir).

### `need()`/`errors[]` accumulate-then-report exit contract
**Source:** `scripts/check-skill-tool-coverage.mjs:56-59,520-548`.
**Apply to:** `scripts/audit-gate.mjs` when run standalone (non-hook mode): collect every failure, print one `FAIL` block with a `-` bullet per failure, `process.exit(1)`; on success print one `OK` summary line with counts. This is more informative than test-gate.mjs's inherited-stdio-only contract and matches D-12-15's "name the property, the offending value, and the route to fix" requirement better, since `check-skill-tool-coverage.mjs`'s messages already do exactly that.

### Derive from ground truth, add a non-vacuity floor
**Source:** `hostpath-consumers.test.ts:182-197` (R2000_MODULE_FLOOR), `docs-review-disposition.test.ts:271-273` (`>= 100` findings floor), `check-skill-tool-coverage.mjs:405-419` (multiple `need()` non-vacuity controls: `extracted.size >= 30`, positive-control tool names).
**Apply to:** both `scripts/audit-gate.mjs`'s guard-file glob and `audit-integrity.test.ts`'s own assertions about that glob — every derived set in this codebase pairs with an explicit lower-bound assertion so an empty/broken glob fails loudly rather than passing vacuously.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.claude/settings.json`'s `PreToolUse` hook entry specifically | config | event-driven | No `PreToolUse` hook exists anywhere in this repo today (only `SessionStart`, in `.claude-plugin/plugin.json`). Use that as the structural precedent for hook-block syntax, but the `matcher` field and hook-mode CLI contract for `audit-gate.mjs` are new territory — verify against Claude Code's actual hook schema (external documentation) before finalizing the plan's action steps. |
| Runtime-constructed synthetic test tree (`mkdtempSync`-style) for D-12-16's planted pair | test | transform | This repo consistently uses **committed fixture files** (`.claude/mcp/vice/fixtures/*.md`) for planted-violation proofs, never a temp directory built at test-run time. Recommended to follow the committed-fixture idiom rather than introduce a new pattern; noted above under `audit-integrity.test.ts`. |

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.mjs`, `.claude/mcp/vice/*.test.ts`, `scripts/*.mjs`, `.claude-plugin/plugin.json`, `.gitignore`, `.planning/phases/08.1-*/`, `.planning/milestones/*.md`, `.github/workflows/ci.yml`
**Files scanned:** ~14 (test-gate.mjs, test-gate.test.ts, hostpath-consumers.test.ts, docs-review-disposition.test.ts, docs-linerefs.test.ts, check-skill-tool-coverage.mjs, check-npm-packages.mjs, plugin.json, .gitignore, package.json, ci.yml, v0.3.0/v0.2.0 MILESTONE-AUDIT.md, 08.1-WALKTHROUGH-EVIDENCE.md, live `.claude/settings.json`/`.claude/settings.local.json` on disk)
**Pattern extraction date:** 2026-08-21
