# Phase 15: Debt and Review Disposition - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** ~30 (1 guard fix, ~19 pending todos, 2 source one-liners, 5 doc-insertion targets, 1 UAT doc, plus disposition addenda)
**Analogs found:** all — this is a disposition phase; every "new file" is really an edit to an existing, precedented artifact class

This phase creates almost nothing new. Every task is either (a) editing an
existing guard test, (b) moving a todo file and appending a `## Resolution`,
(c) editing an existing doc/skill section, or (d) filling in a `result:`
field in an existing `*-HUMAN-UAT.md`. The "analog" for each is therefore
not a similar-but-different file — it is the **exact sibling instance of the
same convention**, quoted verbatim below so the planner can copy the shape
rather than invent one.

## File Classification

| File to modify | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.claude/mcp/vice/docs-review-disposition.test.ts` (`parseFindingIds()` regex) | test/guard (planning-doc) | transform (regex parse of markdown headings) | `.claude/mcp/vice/docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`, `docs-fork-decision.test.ts` (sibling guards, same file) | exact — same file family, same idiom |
| `.planning/todos/pending/*.md` → `.planning/todos/completed/*.md` (≈18 files) | planning-doc / "model" record | CRUD (move + append) | `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`, `.planning/todos/completed/2026-08-21-anno-cli-wr-08-option-values-silently-swallowed.md` | exact |
| `08-REVIEW.md` (WR-04, WR-12 fixes), `stock-dispatch.ts` (WR-13), `stock-connect.ts` (IN-05), `probe-binmon.mjs` (WR-01) | source / one-line-to-small fixes | request-response / string constant | Each finding's own review already has a written diff (`08-REVIEW.md:330-360` etc.) — analog is the review text itself, not another source file | exact (fix pre-specified) |
| `README.md`, `.claude/skills/c64-ram-capture/SKILL.md` (DEBT-02 additions) | docs / user-facing prose | — | Existing adjacent sections in the same files (`## Boot a disk`, `## Troubleshooting`, `## Which skill does what`) | exact — insert in local voice |
| `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` (3 `pending` → `pass`/`fail`) | planning-doc / recorded test result | event-driven (live probe result) | `.planning/phases/08-capability-honesty-and-the-install-story/08-HUMAN-UAT.md` (test 1, already `result: partial` with evidence) | exact |
| `.planning/REQUIREMENTS.md` → Future Requirements (promote `vice_disk_attach` redesign question, `WR-02`/`IN-01`/`IN-02` Phase 13 deferrals) | planning-doc | — | `.planning/REQUIREMENTS.md:99-113` "Future Requirements" / "Fork Backend Follow-on" section | exact |

## Pattern Assignments

### `.claude/mcp/vice/docs-review-disposition.test.ts` — the parser regex

**Analog:** the file's own existing logic, plus the sibling guards' idiom (`docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`, `docs-deferred-ledger.test.ts`, `docs-fork-decision.test.ts`).

**Current regex to widen** (`docs-review-disposition.test.ts:91`):
```typescript
function parseFindingIds(reviewContent: string): string[] {
  const ids: string[] = [];
  const re = /^### (WR|IN|CR)-(\d+):/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reviewContent)) !== null) {
    ids.push(`${m[1]}-${m[2]}`);
  }
  return ids;
}
```

**RESEARCH.md's own verified fix shape** (already regex-tested live this session against the tree, per RESEARCH.md lines 106-139):
```js
const re = /^#{3,4} (WR|IN|CR)-(\d+)[:\s]/gm;
```
Widen to accept level-3 **or** level-4 headings, and either a colon or a
space/paren immediately after the id (covers Phase 03's `#### WR-06:` and
Phase 14's `### IN-01 (Info) — ...`).

**Header-comment convention to preserve** (lines 3-45): every claim about
*why* the guard exists and what it deliberately does NOT do ("mentioned
anywhere" bar, five disposition sources, top-level-only milestone-audit
glob) is documented inline above the code. Any regex change should get the
same treatment — add a comment explaining the two new shapes it now covers
and cite the two ids (`03-REVIEW.md WR-06`, `14-REVIEW.md IN-01`) that motivated it, matching how the existing header cites `AUDIT-01` and Phase 10/11.

**Test-assertion idiom to copy** (`docs-review-disposition.test.ts:271-329`):
- A **positive-control floor** test: `assert.ok(findings.length >= 100, ...)`. RESEARCH.md says this must be bumped/re-asserted (150 > 100, so the existing `>= 100` floor still holds, but add a **named** positive-control assertion pinning `03-REVIEW.md WR-06` and `14-REVIEW.md IN-01` specifically — the exact idiom used at lines 277-285 for other known-present anchors) so this exact regression class cannot silently reopen.
- A **planted-violation** test (lines 291-317) and a **planted false-negative** test (lines 319-329+), each reading a committed fixture file with a synthetic `WR-99` heading. Any new heading-shape support should get a matching planted fixture line (e.g. a `#### WR-99 (Info) — ...` shaped synthetic entry) so the widened parser is itself regression-tested against the two new shapes, not just the widened regex's success on real files.

**Sibling-guard idiom for "read the real doc, don't hardcode a copy" (all four siblings share this):**
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { repoRoot } from "./repo-root.ts";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
```
Every one of the five `docs-*.test.ts` files opens this way — no path
aliases, explicit `repoRoot()` resolution, real file reads rather than
inlined copies of prose. Any new helper function this phase adds should
follow the same `readdirSync`-driven, never-hardcode-a-list style already
used by `scanAllReviewFindings()`.

---

### Pending-todo disposition — the `wont-fix` shape

**Analog:** `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md` (already has a dated in-file `## DISPOSITION` section from a prior user decision — this is the shape to promote into a `## Resolution` on `git mv` to `completed/`):

```markdown
## DISPOSITION (user decision, 2026-08-12)

**Not a bug to fix — these are not automatable.** They depend on manual host
setup (a real broker topology and a real emulator/display environment), so they
cannot be driven unattended. Do NOT sink further effort into making them pass
headless. Exclude them from the automated gate and treat them as manual /
environment-dependent checks.
```

Apply this same shape (bold one-line verdict, then rationale paragraph, then
consequence) as the `## Resolution` section on every todo RESEARCH.md
recommends closing `wont-fix` — Phase 09's `IN-01..03` (evidence
immutability), Phase 13's `IN-01`/`IN-02`, the `.vsf`-bootstrap todo, etc.

### Pending-todo disposition — the fixed-with-commit shape

**Analog:** `.planning/todos/completed/2026-08-21-anno-cli-wr-08-option-values-silently-swallowed.md` — frontmatter plus body structure to copy exactly:

```yaml
---
created: 2026-08-21T00:00:00.000Z
title: <finding + short description> (<source review file> <id>)
area: cli
files:
  - .claude/mcp/vice/anno-cli.ts
---

## Problem
<verbatim repro, cites source review line, quotes the offending code>

## Why it was deferred
<per this project's deviation-scope rule...>

## What to do
<the fix, as code>
```
And `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`
for a **larger** completed todo's frontmatter — note the `resolves_phase: 14`
field and the `files:` list using `path:line-range` citations
(`README.md:72-157`). Any newly-fixed finding without an existing todo
(Phase 03's 8 newly-surfaced ones, Phase 14's `IN-01`, `WR-13`) should either:
(a) get a fresh completed todo in this exact shape with a `## Resolution`
section naming date/phase/commit, or (b) an addendum to the phase's own
`*-VERIFICATION.md` naming the id — **never only `*-REVIEW.md` prose or
`STATE.md` prose**, since neither is a source the guard recognizes
(`docs-review-disposition.test.ts:22-45`).

### Future Requirements promotion — the named-owner shape

**Analog:** `.planning/REQUIREMENTS.md:99-113`:

```markdown
## Future Requirements

Acknowledged, not in this roadmap.

### Upstream Contributions

- **UP-01**: A `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`) — closes stock's hardest loss for everyone, and would satisfy one of `FORK-01`'s reversal criteria
- **UP-02**: The external analyser's `--mcp-port` / `--mcp-bind` (~5 lines) — unblocks two projects at once and a host-side TUI, currently a *stated* limit in this project's install documentation precisely because it cannot be fixed downstream

### Fork Backend Follow-on (FORK-01, decided `retain`, Phase 14 plan 14-05)

Deliberately excluded from Phase 14's own scope (research Pitfall 4: Phase
14's requirements are the decision and the routes, not reimplement-or-drop
24 tools). Each item below is owned follow-on work, not an unstated gap,
tied to the same reversal condition (`UP-01`) that would reopen `FORK-01`:
```

Use this exact bullet shape — bold id (if warranted), one-line summary, em-dash rationale — for the `vice_disk_attach` contract-redesign promotion (DEBT-01's item b) and the `2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md` promotion if not fixed in-phase. Note `REQUIREMENTS.md`'s Traceability table (lines 153-166) lists `GATE-02`/`DEBT-01` etc. as `| ID | Phase | Status |` rows — flip `Pending` → `Complete` there too once done, matching the existing row shape.

---

### DEBT-02 doc insertions — local-voice insertion points

**Analog for `## Boot a disk` (Drive8Type closing note, item 1):** `.claude/skills/c64-ram-capture/SKILL.md:74-82` — current text:
```markdown
## Boot a disk

1. `mcp__plugin_c64-re-tools_vice__vice_disk_attach` with the disk image.
2. `mcp__plugin_c64-re-tools_vice__vice_autostart` with the same image.
3. `mcp__plugin_c64-re-tools_vice__vice_execution_run`.
4. `mcp__plugin_c64-re-tools_vice__vice_registers_get` and confirm the program counter has moved.

If the program counter has not moved, type `LOAD"*",8,1` with
`mcp__plugin_c64-re-tools_vice__vice_keyboard_type`, run it, then type `RUN` and run it.
```
Add a numbered-list-adjacent sentence or a line directly after step 4 (before the "If the program counter has not moved" fallback line), in the same terse imperative voice — no new heading needed per RESEARCH.md ("closing note, not an active workaround").

**Analog for the `.git`-marker prerequisite (item 2):** the skill has **no** dedicated Setup section — RESEARCH.md recommends inserting before `## The order` (`SKILL.md:36`) or into `## Troubleshooting` (`SKILL.md:307`). The Troubleshooting table's existing row shape to match (`SKILL.md:317-333`):
```markdown
| Symptom | Fix |
|---|---|
| `assembleImage: gap before address $3000 -- next chunk starts at $4000` | A `vice_memory_read` never landed. Re-read that 4096-byte window; do not pad it. |
```
A new row following this exact two-column, backtick-quoted-symptom shape is the lowest-friction insertion; a standalone prerequisite line before `## The order` is the alternative RESEARCH.md names — either is local-voice-consistent.

**Analog for the `RELEASES.json` schema subsection (item 3):** insert as a new `## ` heading (this skill's convention is one heading per concern, no `references/` split — see the file's own top-of-file note "No `references/` split: the workflow fits in one file") right before `## References` (`SKILL.md:290`) or after `## Which skill does what` (`SKILL.md:276-288`). Match the existing `## Which skill does what` table shape:
```markdown
| Need | Go to |
|---|---|
| Which address to read next, and what the answer rules out | `c64-program-recon` |
```
for a fields-table, or the `## References` table shape (`SKILL.md:293-300`, `| Path | Covers |`) if shipping a `RELEASES.json.example` file instead.

**Analog for README.md's Development section (context only, not a direct target):** `README.md:312-321` — the section was deliberately simplified to a 5-line block; DEBT-02 items do not touch this section, but it demonstrates the repo's current terse-README convention (no long prose tables) worth matching if any DEBT-02 note lands in README.md rather than the skill.

---

### `03-HUMAN-UAT.md` — recorded pass/fail shape

**Analog:** `.planning/phases/08-capability-honesty-and-the-install-story/08-HUMAN-UAT.md` frontmatter + result shape:
```yaml
---
status: passed
phase: 08-capability-honesty-and-the-install-story
source: [08-VALIDATION.md]
started: 2026-08-18T20:45:50Z
updated: 2026-08-19
resolved_by: Phase 8.2, plan 08.2-04
driven_by: agent-proxy
tested_artifact_sha: 2d76867d0eb4bbb3592da99656f18389146af09b
tested_artifact_route: local-checkout-HEAD
vice_version: "x64sc (VICE 3.9)"
evidence: 08.2-WALKTHROUGH-EVIDENCE.md
---
```
and per-test result prose:
```markdown
result: partial — see below. The install-only half of this test WAS run live,
as an automated proxy for the human's first few steps (not a substitute for the
full test — see `why_human` above):

- Spun up a fresh, unmodified `debian:trixie` Docker container ...
- `sudo apt install vice` **FAILED** on the container's default sources
  ("Unable to locate package vice") — discovered live that Debian ships `vice`
  in the `contrib` component, not `main` ...
```
Apply this exact shape to `03-HUMAN-UAT.md`'s three `pending` scenarios: a
top-level frontmatter `status:`/`resolved_by:`/`tested_artifact_sha:`/
`vice_version:` block, and per-test `result: pass`/`result: fail` prose
citing concrete evidence (register/memory diffs, timing counts), never a
bare pass/fail with no supporting detail. For scenario 3 (checkpoint
auto-disable under hit pressure), record explicitly whether the rate
limiter fired and whether any stall was observed — RESEARCH.md Pitfall 5
requires a genuine `fail` be recorded if the probe finds a real problem,
not softened to force a pass.

## Shared Patterns

### Guard-header documentation convention
**Source:** every `docs-*.test.ts` file's opening comment block (e.g. `docs-review-disposition.test.ts:1-45`, `docs-fork-decision.test.ts:1-16`)
**Apply to:** the `docs-review-disposition.test.ts` regex-widening change — any edit to a guard's matching logic should carry an inline comment naming the specific real-world defect that motivated it (id, file, line), matching the existing "WHY THIS EXISTS" / "SCOPE FENCE" prose style already used throughout this file family.

### Todo lifecycle (`pending/` → `completed/` via `git mv` + `## Resolution`)
**Source:** `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`, `.planning/todos/completed/2026-08-21-anno-cli-wr-08-option-values-silently-swallowed.md`
**Apply to:** all ~18 pending todos this phase disposes, and any newly-filed-and-closed-in-the-same-breath todo for a finding with no existing todo file.

### Disposition-source discipline
**Source:** `docs-review-disposition.test.ts:22-45` (the five recognised sources)
**Apply to:** every GATE-02 disposition — a note added only to `*-REVIEW.md` prose or `STATE.md` prose does not satisfy the guard; it must land in a `*-SUMMARY.md`, `*-VERIFICATION.md`, `*-REVIEW-FIX.md`, a todo (pending or completed) identifiably about that phase, or a top-level `v*-MILESTONE-AUDIT.md`'s `tech_debt:` block.

## No Analog Found / Open Questions Carried Forward

Per RESEARCH.md's own Open Questions section — these are genuinely undetermined and should NOT be resolved by pattern-mapping guesswork:

| Item | Why no analog assigned | RESEARCH.md reference |
|---|---|---|
| Where the `vice_machine_config_set`/WarpMode caveat belongs (`docs/stock-vice-parity.md`'s licensed-divergence register vs. a new `capability-registry.ts` note field) | Genuine schema-vs-doc trade-off, explicitly flagged for planner/human decision, not a copy-a-pattern question | RESEARCH.md Open Question 1, Assumption A3 |
| Whether `2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md` is fixed in-phase or promoted | Time-budget judgment call, not a pattern gap | RESEARCH.md Open Question 2 |
| Whether the widened regex needs a companion heading-style-normalization fix, or is sufficient alone | Forward-looking risk, not resolvable by finding a better analog today | RESEARCH.md Open Question 3 |

## Metadata

**Analog search scope:** `.claude/mcp/vice/docs-*.test.ts` (all 5), `.planning/todos/completed/*.md` (2 read in full), `.planning/phases/*/*-REVIEW.md`, `*-REVIEW-FIX.md`, `*-VERIFICATION.md`, `*-HUMAN-UAT.md` (3 phases' worth), `.planning/REQUIREMENTS.md`, `.claude/skills/c64-ram-capture/SKILL.md`, `README.md`
**Files scanned:** ~20 read directly this session (see excerpts above), all with `path:line` citations
**Pattern extraction date:** 2026-08-22
