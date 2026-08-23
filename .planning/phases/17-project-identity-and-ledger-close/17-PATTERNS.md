# Phase 17: Project Identity and Ledger Close - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 5 confirmed + 1 discretionary (per RESEARCH.md `## Files this phase touches`)
**Analogs found:** 6 / 6 (every file either edits itself against its own established convention, or has a direct sibling analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/docs-deferred-ledger.test.ts` (MODIFY) | test (doc-guard) | transform (fs read → regex extract → assert) | itself — the non-vacuity test's own in-file comment already names this exact phase as the next editor | exact (self-analog) |
| `.planning/PROJECT.md` → `## Core Value` (MODIFY) | config/planning-doc | transform (prose edit) | `.planning/PROJECT.md` → `## Key Decisions` FORK-01 row (dated-decision shape) | role-match (different section, same "dated verdict" pattern) |
| `.planning/STATE.md` → `## Deferred Items` + `### Pending Todos` (MODIFY) | config/planning-doc | CRUD (ledger row removal) | itself — Phase 15's own prior edits to the same two sections (`STATE.md:~690-736`, `~460-497`) | exact (self-analog, same file/section, same editor convention repeated 6+ times already) |
| `.planning/REQUIREMENTS.md` (MODIFY) | config/planning-doc | CRUD (checkbox flip + closure note + traceability row) | FORK-01/FORK-02 closure note (`REQUIREMENTS.md:85-105`) and DEBT-01 closure note (`:111-130`) | exact |
| `.planning/ROADMAP.md` → Phase 17 section (MODIFY) | config/planning-doc | CRUD (fill `**Plans**: TBD`, tick criteria, add Notes) | Phase 16 closure block (`ROADMAP.md:382-457`) | exact |
| `src/mcp/vice/docs-core-value-decision.test.ts` (NEW, discretionary) | test (doc-guard) | transform | `src/mcp/vice/docs-fork-decision.test.ts` (full file) | exact (explicitly named in RESEARCH.md as the template) |

## Pattern Assignments

### `src/mcp/vice/docs-deferred-ledger.test.ts` (test, transform) — the tracer task

**Analog:** itself (180 lines, read in full this session).

**Imports pattern** (lines 30-36):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";
```

**Helpers to reuse verbatim, no change needed** (lines 48-80):
```typescript
function todoStems(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
}

function deferredItemsSection(stateMd: string): string | null {
  const m = stateMd.match(/^## Deferred Items\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}

function missingPendingStems(pendingStems: readonly string[], sectionText: string): string[] {
  return pendingStems.filter((stem) => !sectionText.includes(stem));
}

function wronglyListedCompletedStems(completedStems: readonly string[], sectionText: string): string[] {
  return completedStems.filter((stem) => sectionText.includes(stem));
}
```

**The exact block that must change — non-vacuity test** (lines 112-140):
```typescript
test("non-vacuity: the Deferred Items section is located, non-empty, and the scanned sets clear a floor", () => {
  const stateMd = readFileSync(STATE_MD, "utf8");
  const section = deferredItemsSection(stateMd);
  assert.ok(section !== null, "the '## Deferred Items' heading was not found -- a renamed heading must FAIL this test, not silently pass elsewhere");
  assert.ok(section!.trim().length > 0, "the located Deferred Items section is empty");

  const pending = todoStems(PENDING_DIR);
  const completed = todoStems(COMPLETED_DIR);
  // Floors are a non-vacuity sanity check only ("did the scan find SOMETHING",
  // not "does the debt count match a fixed contract") -- lowered from 10 to 5
  // by phase 15 plan 15-10 ... then from 5 to 2 by phase 15 plan 15-12 ...
  // Lower again, rather than raise, if it ever trips for the same
  // reason -- DEBT-04 (Phase 17) may shrink this further still.
  assert.ok(pending.length >= 2, `expected at least 2 pending todos, got ${pending.length}`);
  assert.ok(completed.length >= 5, `expected at least 5 completed todos, got ${completed.length}`);

  // Positive control: a specific, known-present pending stem must actually
  // be found by predicate 1's own matcher -- without this, the two tests
  // above could both pass by scanning nothing. ...
  const knownStem = "2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json";
  assert.ok(pending.includes(knownStem), `expected ${knownStem} to be a real pending todo -- update the control if it has been resolved`);
  assert.deepEqual(missingPendingStems([knownStem], section!), [], `the positive-control stem ${knownStem} was not found by missingPendingStems() against the real section text`);
});
```

**Fix shape (RESEARCH.md's recommendation, option (a)):** lower `pending.length >= 2` to `>= 0` (or drop that assertion), and make the positive-control block conditional on `pending.length > 0` — keep the `completed.length >= 5`, section-located, and non-empty checks unconditional. The comment block explaining the floor's history (already present, lines 120-127) should be extended with a phase-17 sentence in the same voice ("Phase 17 (DEBT-04) dropped the floor to 0 when the pending tree first reached empty; the positive control is now conditional on pending existing at all"), matching how the existing comment narrates each prior phase's edit inline rather than replacing the history.

**Planted-violation test — the "assert without depending on live state" shape to imitate** (lines 142-179, unaffected by this fix, but the shape to copy if a synthetic positive control is chosen instead of option (a)):
```typescript
test("planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither", () => {
  const sectionMissingAPendingStem = `
| Category | Item | Priority | Status |
|----------|------|----------|--------|
| todo | 2026-08-12-vice-broker-tests-stall-outside-devcontainer | low | Pending |
`;
  const missing = missingPendingStems(["2026-08-20-vsf-as-a-bootstrap-input"], sectionMissingAPendingStem);
  assert.deepEqual(missing, ["2026-08-20-vsf-as-a-bootstrap-input"], "...");
  // ... second synthetic block for predicate 2, then the real-file assertions ...
});
```

**Verification commands:**
```bash
cd src/mcp/vice && node --test docs-deferred-ledger.test.ts   # fast, per-task
cd src/mcp/vice && npm test                                    # full suite, phase gate
```

---

### `.planning/PROJECT.md` → `## Core Value` (planning-doc, transform)

**Analog:** the FORK-01 row in `## Key Decisions` (`PROJECT.md:278`), the directly reusable dated-decision shape named by RESEARCH.md.

**Current Core Value text to edit, verbatim** (`PROJECT.md:32-51`, quoted in full in RESEARCH.md — do not re-read, use this):
```
## Core Value

A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

*Still correct after v0.2.0.* Shipping the second backend did not shift it; the
milestone widened *which* emulator qualifies as "a real C64 emulator" without
changing what the session needs to do with it.

**Flagged at the v0.3.0 close, deliberately not rewritten yet.** This statement
is entirely about driving a *live* emulator, and v0.3.0's whole point is the
opposite axis: findings that persist as queryable state *between* sessions, held
by a tool that never touches the emulator at all. The two-session sealed-question
test proved that value directly. One milestone of evidence is thin ground for
restating the ONE thing, so it is recorded as the first question
`/gsd-new-milestone` should ask rather than silently amended here. Candidate
shape: *a Claude session can drive a real C64 emulator to reverse-engineer a
program, and what it learns outlives the session.*
```

**FORK-01's dated-decision shape to mirror** (`PROJECT.md:278`, table row — copy the field structure, not the table format, since Core Value is prose not a table):
```
Decision: Retain the forked VICE MCP backend as the default hedge (FORK-01, decided 2026-08-22)
Rationale: [both sides of the evidence named specifically, by file/test/opcode name]
Outcome: ⚠️ Revisit — pinned by the committed guard `docs-fork-decision.test.ts`. [specific adequacy evidence, file-cited]
```

**Fields to carry in the new Core Value paragraph** (per RESEARCH.md's own synthesis, restated here as the concrete template):
- A stated ISO date (`2026-08-23`).
- An explicit verdict word (restate / keep-as-is).
- Named evidence citations — reuse these exact anchors, all independently verified this session:
  - "Phase 11's two-session sealed-question test" / hash `e64463d8…` (`PROJECT.md:275`)
  - "the symbol round trip" (`PROJECT.md:81`, R2000-14/R2000-15)
  - "the 17 curated `r2000_*` tools" (`PROJECT.md:79-80`)
- If kept: a named reversal/revisit condition, in the same voice as FORK-01's "This decision reverses if UP-01 lands: ..." sentence.

**Out of Scope cross-reference pattern** (only if CORE-01 verdict is "kept" and a symmetric guard is built) — mirror the fork-backend bullet at `PROJECT.md:109`:
```
*Reaffirmed at v0.2.0 close: the fork's 62-tool surface shipped unchanged. Formalised by FORK-01 (Key Decisions, 2026-08-22): retained as the default hedge, now with dated reversal criteria — see that row rather than treating this bullet as the sole record.*
```

---

### `.planning/STATE.md` → `## Deferred Items` + `### Pending Todos` (planning-doc, CRUD)

**Analog:** itself — Phase 15's own prior edits to these exact two sections, which is the house style to imitate for the Phase 17 edit.

**Current `## Deferred Items` prose + table to replace, verbatim** (STATE.md, in the Deferred Items section):
```
**Current, as of phase 15 plan 15-12 Task 3, the phase's final reconciliation
(2026-08-22): 2 items — 2 pending todos, zero UAT gaps.** The `uat_gap` row
present since the v0.2.0 close is removed here: `03-HUMAN-UAT.md` now records
zero `result: [pending]` rows (scenario 1 pass, scenario 2 partial — an
honest joystick negative result, not a pending one — scenario 3 pass, all
closed live by plans 15-08/15-10), so per this table's own accounting rule
(pending todo files plus any UAT-gap row still open) there is nothing left
to carry as a `uat_gap` row. The count in this paragraph is derived from,
and must equal, the row count of the table immediately below it — this is
also, for the first time, the arithmetic in full: 2 pending todo files in
`.planning/todos/pending/` + 0 UAT-gap rows = 2.

| Category | Item | Priority | Status |
|----------|------|----------|--------|
| todo | 2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json | — | Pending — promoted to `PKG-01` (Phase 16), named owner recorded in `REQUIREMENTS.md` → Future Requirements by plan 15-12 |
| todo | 2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments | — | Pending — promoted to `PKG-03` (Phase 16), named owner recorded in `REQUIREMENTS.md` → Future Requirements by plan 15-12 |
```

**Shape to write in its place** (following the exact convention — "Current, as of Phase [N] [plan/task], (date): N items ..." paragraph, immediately followed by the table, with the arithmetic spelled out in full, matching every prior update's habit of showing the count derivation): a "Current, as of Phase 17 [plan/task] (2026-08-23): 0 items — 0 pending todos, zero UAT gaps." paragraph, the accounting-rule sentence restated, the arithmetic "0 pending todo files + 0 UAT-gap rows = 0" spelled out the same way, and either an empty table (with a header-only shape) or a one-line "no items" statement — check how `docs-deferred-ledger.test.ts`'s `deferredItemsSection()` regex behaves against a section with no table rows (it only needs non-empty *text*, per the non-vacuity test's `section!.trim().length > 0` check, so prose alone satisfies it — a header-only table is not required).

**`### Pending Todos` prose paragraph to edit atomically with the above** — the current paragraph (STATE.md, `### Pending Todos` section) states "Two todos remain pending, both promoted to a Phase 16 requirement..." — this must be updated in the same edit to state zero remain, cross-referencing that both named items (`PKG-01`, `PKG-03`) are now `Complete` per Phase 16's closure. Preserve the same phrase "this prose figure must always equal that section's table row count, which has gone stale twice before and is not itself guarded" as a still-true caution, updated to reflect the new (zero) figure.

---

### `.planning/REQUIREMENTS.md` (planning-doc, CRUD)

**Analog:** FORK-01/FORK-02 closure note (`REQUIREMENTS.md:85-105`) and DEBT-01 closure note (`:111-130`) — both read in full.

**Checkbox + closure-note shape to copy** (FORK-01 example, `REQUIREMENTS.md:85-105`):
```
- [x] **FORK-01**: The fork-backend question is answered by a dated decision in PROJECT.md → Key Decisions that names the criteria which would reverse it, including the upstream `KEYBOARD_MATRIX_SET` coupling — not retained by default for a third close

  > **Closure note (Phase 14, plan 14-05).** `FORK-01` decided `retain` —
  > by a **human**, at plan 14-01's `gate="blocking-human"` checkpoint, after
  > explicit escalation (not inferred, not auto-approved). Recorded in
  > `.planning/PROJECT.md` → Key Decisions, dated 2026-08-22, naming the
  > upstream `KEYBOARD_MATRIX_SET` opcode landing as the reversal criterion,
  > and pinned by `.claude/mcp/vice/docs-fork-decision.test.ts`. ...
```

**Fields the closure note must carry, per this convention** (extracted from both examples): who decided (if a checkpoint gate applies — for CORE-01, name the gate the same way "at plan 14-01's `gate=\"blocking-human\"` checkpoint" is named), where it is recorded (file + section + date), what mechanically pins it (a named guard file, if one exists — for DEBT-04, name `docs-deferred-ledger.test.ts`; for CORE-01, state plainly that no guard exists unless the discretionary one is built), and what evidence closes it (cite plan/task numbers and specific artifacts, e.g. "plan 14-03 exercised... 6/6 passing").

**DEBT-01 closure note's count-arithmetic shape to copy for DEBT-04** (`REQUIREMENTS.md:111-130`):
```
> **Closure note (Phase 15, plan 15-12).** The pending count moved from **21** (as of plan
> 15-01, after the guard-widening exposed nine previously-invisible findings) to **2** at
> this closure — 19 todos closed across plans 15-04 through 15-12. This is the Phase-15
> count, not the milestone-final one: Phase 17 measures `DEBT-04` after Phase 16 discharges
> the payload-relocation todo (`PKG-01`), the last item this milestone's own work still
> removes. ...
```
DEBT-04's own closure note should close this exact forward-reference — state the count moved from 2 (Phase 15 close) → 0 (Phase 17, after Phase 16 discharged `PKG-01`), citing the guard fix commit and the STATE.md edit commit.

**Traceability table rows to flip** (`REQUIREMENTS.md:373-374`, current state):
```
| DEBT-04 | 17 | Pending |
| CORE-01 | 17 | Pending |
```
Change `Pending` → `Complete` for both, matching every other row in the table (e.g. `| FORK-01 | 14 | Complete |`, `| DEBT-01 | 15 | Complete |`).

---

### `.planning/ROADMAP.md` → Phase 17 section (planning-doc, CRUD)

**Analog:** Phase 16's closure block (`ROADMAP.md:382-457`), the freshest example of filling in a `TBD` and adding outcome Notes.

**Shape to copy — the `**Plans**:` line** (Phase 16, `ROADMAP.md:421`):
```
**Plans**: 11/11 plans executed
```
Phase 17's current line (`ROADMAP.md:494`) reads `**Plans**: TBD` — replace with the actual count once the plan is written and executed (e.g. `**Plans**: 1/1 plans executed` if RESEARCH.md's single-plan/single-wave recommendation is followed).

**Shape to copy — Plans list with wave structure and one-line task summaries** (Phase 16, `ROADMAP.md:423-456`):
```
Plans:
**Wave 1**

- [x] 16-01-PLAN.md — Tracer: relocate the six skills to `src/skills/` end-to-end (...)
...
```
Phase 17 should list its single plan (or the wave(s) actually used) with `[x]` and a one-line summary in the same imperative, colon-free style ("Tracer: fix the guard's zero-pending edge case", etc.).

**Shape to copy — a resolved "consequence" callout, if one is added** (Phase 16's own "Fork-decision consequence (resolved ...)" block, `ROADMAP.md:395-403`) — Phase 17 already has such a block (`ROADMAP.md:473-482`) that itself needs a closing update once the true count is measured, following the same "(resolved [date], Phase [N] plan [N])" heading convention.

**Success criteria checkboxes** (`ROADMAP.md:490-492`) — tick `[ ]`-less criteria list items are currently unticked prose bullets (numbered, not checkboxed, in this section's format) — compare Phase 16's own criteria list (`ROADMAP.md:408-412`, also numbered prose, not checkboxes) to confirm this phase's Success Criteria section uses the same un-checkboxed numbered-list format; the checkbox convention (`[x]`) applies only to the Requirements line and the Plans list, not to Success Criteria, which stays prose and is instead validated by the closure note / Progress section.

---

### `src/mcp/vice/docs-core-value-decision.test.ts` (NEW, discretionary — build only if CORE-01 verdict is "kept, dated confirmation")

**Analog:** `src/mcp/vice/docs-fork-decision.test.ts` (full file, 181 lines, read this session — reproduce its exact shape, adapted section target).

**Imports pattern** (identical to fork guard, lines 17-23):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";
```

**Section-extraction pattern — adapt from `## Key Decisions` to `## Core Value`** (fork guard lines 35-42):
```typescript
function keyDecisionsSection(projectMd: string): string | null {
  const m = projectMd.match(/^## Key Decisions\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}
```
CORE-01 analog: `/^## Core Value\n([\s\S]*?)(?=\n## )/m` against `PROJECT.md` — Core Value is prose, not a table, so there is no `keyDecisionsDataRows()`-equivalent row filter; the guard instead checks the section text directly for a date pattern and named evidence strings.

**Date-check pattern to copy verbatim** (fork guard lines 123-134):
```typescript
test("3. the FORK-01 row states an ISO YYYY-MM-DD date", () => {
  ...
  assert.match(
    forkRow,
    /\d{4}-\d{2}-\d{2}/,
    "the FORK-01 row does not contain an ISO YYYY-MM-DD date -- a decision recorded without a date " +
      "cannot be distinguished from the default-carried status quo FORK-01 exists to stop",
  );
});
```

**Named-evidence citation pattern to copy verbatim** (fork guard lines 136-151, the `KEYBOARD_MATRIX_SET` case-sensitive check) — CORE-01 analog: require the literal string `"Phase 11"` or `"sealed-question"` (RESEARCH.md's own recommendation) to appear in the Core Value section, same case-sensitive-`.includes()` style.

**Reversal-condition pattern to copy verbatim** (fork guard lines 29-33, 153-165, the `REVERSAL_PHRASES` array + test 5) — reuse the same `REVERSAL_PHRASES` array shape (`["reverses if", "would reverse", "reversal criteria"]`) if the CORE-01 verdict is "kept" and needs a named revisit condition; skip this test entirely if the verdict is "restate" (RESEARCH.md notes a restatement needs no reversal condition, since the new wording is itself the acted-on evidence).

**Non-vacuity test pattern to copy** (fork guard lines 93-106) — adapt the `>= 20 rows` floor to something meaningful for prose (e.g. section length in characters, or presence check only — Core Value is one paragraph, not a table, so a row-count floor does not apply).

## Shared Patterns

### "Doc-guard" family conventions (applies to both the modified ledger guard and any new Core Value guard)
**Source:** all five files in `src/mcp/vice/docs-*.test.ts` (census: `docs-dangling-refs.test.ts`, `docs-deferred-ledger.test.ts`, `docs-fork-decision.test.ts`, `docs-linerefs.test.ts`, `docs-review-disposition.test.ts`)
**Apply to:** `docs-deferred-ledger.test.ts` edit and any new `docs-core-value-decision.test.ts`
- Every file opens with a `WHY THIS EXISTS` block comment naming the specific defect/drift incident that motivated it (e.g. AUDIT-04, FORK-01), not a generic description.
- Every file is deliberately kept **out of `package.json`'s `files[]`** — planning-facing guards, not shipped runtime behavior. State this explicitly in any new file's header comment.
- Section-extraction regex shape is always `/^## Heading\n([\s\S]*?)(?=\n## )/m`, returning `null` (not `[]` or `""`) when the heading is missing, and every test that depends on it asserts `!== null` first with a message naming "has it been renamed?" as the likely cause.
- A "planted violation" / synthetic-input test always accompanies the real-data test, proving the predicate can actually fire (not just pass vacuously) — see `docs-deferred-ledger.test.ts:142-179` and reuse this shape for any new guard's own non-vacuity proof.
- Positive controls are named as such in a comment and updated inline with a dated note when the specific stem/token used as the control is resolved/renamed (see the running commentary in `docs-deferred-ledger.test.ts:120-127, 131-136`) — this is the established way to keep a positive control from silently going stale.

### Planning-doc closure-note convention
**Source:** `.planning/REQUIREMENTS.md:85-130` (FORK-01/FORK-02, DEBT-01 closure notes)
**Apply to:** REQUIREMENTS.md edits for CORE-01 and DEBT-04
- Blockquote (`> `) immediately under the ticked checkbox item.
- First line: `**Closure note (Phase N, plan N-NN).**` then the verdict in backticks if it's a named decision token.
- Names who/what decided (human at a named gate, or mechanical count), where it's recorded (file → section, dated), what pins it mechanically (a named guard file, or "no guard" stated plainly), and what evidence closes it (plan/task numbers, file-cited artifacts).

### Planning-doc running-count-arithmetic convention
**Source:** `.planning/STATE.md`'s `## Deferred Items` section, updated identically by every plan from 15-04 through 15-12 (e.g. "pending 13 → 12, total 14 → 13")
**Apply to:** STATE.md's Phase 17 edit
- Every count change is stated as `before → after` inline in the same sentence that names the plan/task and the reason, never as a bare final number without its derivation shown.

## No Analog Found

None — every file this phase touches (per RESEARCH.md's confirmed table) has a direct, previously-established analog in the same file/section (self-analog) or a structurally identical sibling file (`docs-fork-decision.test.ts` for the discretionary new guard). No RESEARCH.md code-example fallback was needed.

## Metadata

**Analog search scope:** `src/mcp/vice/docs-*.test.ts` (5 files), `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 14-17 sections)
**Files scanned:** 5 test files (full read for 2, header-only census for 3), 4 planning docs (targeted section reads)
**Pattern extraction date:** 2026-08-23
