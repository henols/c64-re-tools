---
phase: 17-project-identity-and-ledger-close
reviewed: 2026-08-23T09:19:59Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/mcp/vice/audit-integrity.test.ts
  - src/mcp/vice/docs-core-value-decision.test.ts
  - src/mcp/vice/docs-deferred-ledger.test.ts
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-08-23T09:19:59Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

These three files are mechanical audit-integrity guards, not product code, so
the review question was: can each guard be satisfied without the condition it
claims to check actually holding? Two BLOCKER-level answers came back yes, both
proven by direct reproduction rather than inspection alone:

1. `docs-core-value-decision.test.ts`'s four predicates (section located,
   ISO date present, named evidence present, reversal phrase present) are
   checked independently anywhere in the `## Core Value` section, with no
   requirement that they co-occur in, or agree with, the actual verdict. A
   synthetic section stating the *opposite* verdict ("should be REMOVED, not
   kept") passed all four predicates in a reproduced run.
2. `scripts/audit-gate.mjs`'s own `EXPECTED_DOCS_GUARD_NAMES` completeness
   registry — the mechanism `audit-integrity.test.ts` exists to exercise —
   was never extended past its original four-guard Phase-12 list, despite an
   inline comment instructing exactly that "the day a fifth guard is added."
   Deleting the brand-new `docs-core-value-decision.test.ts` from the real
   tree and re-running the gate produced `allowed: true` with zero
   `structuralErrors` — the guard this phase just added can silently vanish
   and the mechanism GATE-01 exists to make impossible says nothing.

Two further WARNING-level robustness gaps were found in
`docs-deferred-ledger.test.ts`'s handling of the now-empty pending tree and
its substring-based stem matching. `docs-deferred-ledger.test.ts`'s two-
directional predicates themselves are otherwise sound, and
`audit-integrity.test.ts`'s hook-mode and settings-wiring coverage (outside
the guard-registry gap above) is thorough and well-evidenced.

All findings below were reproduced against the real repository tree (not
just reasoned about) and the tree was left byte-identical afterward
(`git status` / `diff` confirmed clean before writing this report).

## Critical Issues

### CR-01: `docs-core-value-decision.test.ts`'s predicates do not check the verdict itself — a contradicting or unrelated verdict passes every check

**File:** `src/mcp/vice/docs-core-value-decision.test.ts:66-85` (predicates), `:87-140` (tests 1-4)
**Issue:**
`hasIsoDate`, `hasNamedEvidence`, and `hasReversalPhrase` each scan the whole
`## Core Value` section independently for a bare pattern — any ISO date
anywhere, any of `EVIDENCE_PHRASES` anywhere, any of `REVERSAL_PHRASES`
anywhere. None of them are anchored to the actual verdict sentence, and there
is no predicate at all that checks *what the verdict says* (e.g. that it is
`keep`, not `removed`/`reversed`/`changed`).

Reproduced: the following synthetic `## Core Value` body — which explicitly
records the **opposite** conclusion from the one this guard exists to pin —
passes the length floor, `hasIsoDate`, `hasNamedEvidence`, and
`hasReversalPhrase` simultaneously:

```
This project's core value statement should be REMOVED, not kept, decided
2026-08-23, since none of the evidence justifies retaining it as the primary
axis. Unrelated aside: Phase 11 shipped tooling not used for this argument.
This would reverse if someone reads this paragraph again next milestone.
```

Verified directly (not merely reasoned about) by extracting the three
predicate functions verbatim and running them against this string: all three
return `true`, and the length floor (200 chars) is cleared. A future editor
who softens, reverses, or contradicts the CORE-01 verdict — while leaving
*some* date and *some* occurrence of "Phase 11" or a reversal-shaped phrase
anywhere else in the section — would sail through all four tests. This is
exactly the silent-drift failure mode the file's own header names as the
motivation for its existence ("a later edit can... quietly delete the
reversal condition, and the section would still read plausibly to a casual
reader") — the guard does not actually close that gap for the *verdict word*
itself, only for the presence of three independent, unanchored tokens.

Note this is not merely a hypothetical: the planted-violation test (test 5,
lines 142-186) only exercises three "missing X" shapes (missing date, missing
evidence, missing reversal). It never constructs a "verdict flipped, but all
three tokens still present" shape — which is precisely the shape that slips
through.

**Fix:** Require the date, evidence phrase, and reversal phrase to co-occur
within the same sentence/paragraph as an explicit verdict token, and add a
predicate that asserts the verdict word itself. For example, anchor on the
literal `**Kept as-is (CORE-01, decided YYYY-MM-DD)**` (or `**keep-dated**`)
marker this file's own header says was recorded, and scope the other three
predicates to a window starting at that marker rather than the whole section:

```ts
const VERDICT_RE = /\*\*Kept as-is \(CORE-01, decided (\d{4}-\d{2}-\d{2})\)\.\*\*/;

function verdictWindow(section: string): string | null {
  const m = section.match(VERDICT_RE);
  if (!m) return null;
  // scope evidence/reversal checks to the verdict paragraph and what follows,
  // not the whole section, so an unrelated "Phase 11" or date elsewhere
  // cannot satisfy the check.
  return section.slice(m.index!);
}
```
Then add a test-5-style planted case that keeps the date/evidence/reversal
tokens but flips or removes the verdict marker itself, and assert it is
flagged.

---

### CR-02: The docs-guard completeness registry was never extended for the last two guards added — a named guard can vanish with zero structural error, defeating GATE-01

**File:** `src/mcp/vice/audit-integrity.test.ts:64-71, :202-210` (test asserts against the wrong surface); root cause in `scripts/audit-gate.mjs:108-113` (`EXPECTED_DOCS_GUARD_NAMES`, `DOCS_GUARD_FLOOR = 4` at `:101`), consumed at `scripts/audit-gate.mjs:365-368` and `:847-852`
**Issue:**
`audit-integrity.test.ts`'s own header states the file's job is Layer 1 —
proving `scripts/audit-gate.mjs`'s real CLI contract, including "the docs
guard set is derived from disk with a non-vacuity floor (D-12-07 / D-12-08)."
This phase (17-02) correctly added `docs-core-value-decision.test.ts` to the
test file's *local* comparison array, `EXPECTED_GUARD_NAMES_FOR_ASSERTION`
(line 64-71). But that array is only ever compared against
`json.guardFiles` — itself derived live from `readdirSync` on every run
(`docsGuardFiles()` in `audit-gate.mjs`) — so it will always mirror
whatever `docs-*.test.ts` files happen to exist on disk. It provides no
signal at all about whether `audit-gate.mjs`'s *own* internal completeness
check (`EXPECTED_DOCS_GUARD_NAMES`, the thing that is supposed to catch "a
specific named guard went missing") was kept in sync.

It was not: `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` (line
108-113) still lists only the original four Phase-12 guard names
(`docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`,
`docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts`). Neither
`docs-fork-decision.test.ts` nor the brand-new
`docs-core-value-decision.test.ts` was ever added, despite the comment
directly above that array reading: *"Extend this array (in a commit,
alongside the new guard file) the day a fifth guard is added; do not create
a second, competing list anywhere else."* That instruction was not followed
for either the fifth or the sixth guard.

Reproduced directly against the real tree: with
`docs-core-value-decision.test.ts` temporarily removed from
`src/mcp/vice/` (restored immediately after, `git status`/`diff` confirmed
clean), running `node scripts/audit-gate.mjs --root <repo> --json` produced:

```json
{
  "allowed": true,
  "structuralErrors": [],
  "guardFiles": ["docs-dangling-refs.test.ts","docs-deferred-ledger.test.ts",
                 "docs-fork-decision.test.ts","docs-linerefs.test.ts",
                 "docs-review-disposition.test.ts"],
  "redGuards": []
}
```

The floor (`DOCS_GUARD_FLOOR = 4`) is still cleared by the remaining five
files, and the `for (const name of EXPECTED_DOCS_GUARD_NAMES)` membership
loop (`audit-gate.mjs:365-368` and its `--hook`-mode twin at `:847-852`)
never checks for `docs-core-value-decision.test.ts` because it was never
added to that list — so its disappearance is invisible to both the
CLI-check path `checkAuditGate()` and the live hook path
`hookGuardVerdict()`. The same gap applies to `docs-fork-decision.test.ts`.
This is the exact class of failure this whole subsystem was built to make
"mechanically impossible" (per `audit-gate.mjs`'s own header, quoting the
v0.3.0 incident) — a guard silently disappearing from enforcement with
nobody noticing — now reproducible against the two newest guards.

`audit-integrity.test.ts` has no test that would have caught this: its
"synthetic tree below the guard floor" test (`:302-315`) only exercises
losing enough guards to breach the numeric floor, never "a specific,
previously-registered guard is gone while the floor is still met by the
survivors."

**Fix:** Two changes are needed, one in each file:

1. In `scripts/audit-gate.mjs`, extend `EXPECTED_DOCS_GUARD_NAMES` (line
   108-113) to the full current six-item list:
```js
export const EXPECTED_DOCS_GUARD_NAMES = Object.freeze([
  "docs-linerefs.test.ts",
  "docs-dangling-refs.test.ts",
  "docs-deferred-ledger.test.ts",
  "docs-review-disposition.test.ts",
  "docs-fork-decision.test.ts",
  "docs-core-value-decision.test.ts",
]);
```
2. In `audit-integrity.test.ts`, add a test that proves the registry-sync
   mechanism itself has teeth — e.g. delete each `EXPECTED_GUARD_NAMES_FOR_ASSERTION`
   entry from a copy of the real guard set (or synthesize a tree that omits
   exactly one named, previously-registered guard while staying above the
   floor) and assert `structuralErrors` is non-empty. Today's
   "synthetic tree below the guard floor" test does not cover this case
   because it always drops the count below the floor rather than dropping a
   specific name while staying above it.

## Warnings

### WR-01: `docs-deferred-ledger.test.ts`'s direction-A predicate is now only exercised against synthetic data, never against the real file

**File:** `src/mcp/vice/docs-deferred-ledger.test.ts:82-95, :112-152`
**Issue:** With the pending tree now genuinely empty (`todoStems(PENDING_DIR)`
returns `[]` in the real repo, confirmed), the "every pending todo has a row"
test (`:82-95`) calls `missingPendingStems([], section)`, which is
vacuously `[]` regardless of what `section` actually contains. The positive
control that would otherwise exercise predicate 1 against real data
(`:148-151`) is explicitly gated on `pending.length > 0`, so it does not run
either. The only place predicate 1 is now exercised meaningfully is the
fully-synthetic planted-violation test (`:154-179`), which proves the
*predicate function* works but proves nothing about whether
`deferredItemsSection()`'s heading-boundary regex is still correctly bounding
the real `STATE.md` file. If that regex regressed (e.g. a heading reordering
in `STATE.md` shifted the captured slice) in a way that still yields a
non-empty section not coincidentally containing any of the 35 completed
stems, both real-data tests (`:82-95` and `:97-110`) would still pass. This
is the exact "non-vacuity floor that is itself conditional... rot[s] into a
tautology" shape flagged as a risk for this change.
**Fix:** Add a real-data assertion that does not depend on `pending.length`,
e.g. assert the extracted section's raw text against a small structural
invariant (starts with the literal table header, or contains a known
constant substring from the section's own prose, such as "derived from
`.planning/todos/pending/`"), so a boundary regression is caught even while
the pending tree is empty:
```ts
test("non-vacuity: the located section is provably the real Deferred Items table, independent of pending count", () => {
  const section = deferredItemsSection(readFileSync(STATE_MD, "utf8"));
  assert.ok(section !== null);
  assert.ok(
    section!.includes("derived from `.planning/todos/pending/`"),
    "the located section does not contain STATE.md's own known Deferred Items prose -- possible heading-boundary regression",
  );
});
```

### WR-02: Stem/phrase matching via unanchored `String.prototype.includes` risks both false negatives and false positives on substring collision

**File:** `src/mcp/vice/docs-deferred-ledger.test.ts:68-80` (`missingPendingStems`, `wronglyListedCompletedStems`); `src/mcp/vice/docs-core-value-decision.test.ts:75-85` (`hasNamedEvidence`, `hasReversalPhrase`)
**Issue:** Both files key their core predicates on `text.includes(token)`
rather than a structurally-anchored match (a table cell, a line start, a
word boundary). For the ledger, if two todo stems are ever such that one is
a literal substring of the other (e.g. a later, longer-named todo
accidentally shares a prefix with an earlier one), `wronglyListedCompletedStems`
could report a false positive against a still-pending row that merely
contains the shorter stem as a substring, or `missingPendingStems` could
report a false negative because a *different* stem's occurrence
coincidentally supplies the substring. This is currently inert (the pending
tree is empty), but it is a live risk the moment new pending todos are
added. For the Core Value guard, unanchored substring matching is also what
makes CR-01 possible (an unrelated sentence containing "Phase 11" satisfies
`hasNamedEvidence` with no connection to the actual evidence-weighing
prose).
**Fix:** For the ledger, match against table rows specifically (e.g.
`` `| todo | ${stem} |` `` or a regex requiring the stem to be followed by
`` ` |` ``) rather than a bare substring, so a stem can only match its own
row. For Core Value, see CR-01's fix (anchor evidence/reversal checks to the
verdict window).

---

_Reviewed: 2026-08-23T09:19:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
