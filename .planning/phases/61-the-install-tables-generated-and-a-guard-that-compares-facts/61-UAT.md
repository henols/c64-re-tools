---
status: complete
phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts
source: [61-VERIFICATION.md]
started: 2026-09-19T08:40:00Z
updated: 2026-09-19T08:45:00Z
---

## Current Test

none — all human verification items resolved.

## Tests

### 1. D-08 scope judgment: literal wording vs. substantive intent

expected: A recorded decision between (a) accept and close with a follow-up gap plan, or
(b) require the gap plan first.

**The facts, all independently verified — none of these is in dispute:**

- Plans 61-01 and 61-03 each carry the must-have: "`src/mcp/vice/phase58-citation-ledger.test.ts`
  is green after every commit that moves a README.md line (D-08)."
- That test file's exit code is 1. Two of its tests fail.
- Those two tests fail on five drifted anchors. **Every one cites `.planning/`. None cites README.md.**
- Every README.md-citing ledger entry resolves correctly, confirmed after each commit that moved
  a README line.
- Four of the five drifted because the Phase 61 *planning* commits grew `.planning/ROADMAP.md`
  and `.planning/REQUIREMENTS.md`. Their anchor text still exists, at shifted line numbers.
- The fifth, `.planning/ROADMAP.md:2002-2005` anchor "a user missing ACME learns that", cites a
  sentence **deleted** by `67a0d810 docs(61): drop the doctor phase at owner decision`. It is not
  a line bump; its support was withdrawn and it needs a decision of its own.
- No plan in this phase declared `.planning/ROADMAP.md` or `.planning/REQUIREMENTS.md` in
  `files_modified`, so repairing them was outside every executor's sanctioned scope.
- The failing set is byte-identical to the pre-phase baseline. Pre-phase: 4032 tests / 3949 pass /
  2 fail. Post-phase: 4051 / 3968 / 2 fail. Every test this phase added is green; nothing regressed.

**Why this is a human call:** the literal must-have says the FILE is green, and it is not. The
substantive concern it encodes — don't let a README line move break a citation that points at
README — was fully met. Both executors flagged this ambiguity as `human_judgment: true` rather
than claiming a pass, and the verifier preserved it rather than resolving it.

result: PASSED — option (a), decided by the project owner 2026-09-19.

**Decision:** the substantive D-08 concern is met. Every README.md-pointing ledger entry
resolves correctly after every commit that moved a README line, which is what the must-have
exists to protect. The test file exit code 1 is caused entirely by five `.planning/` anchors
that no plan in this phase was scoped to touch, and the failing set is byte-identical to the
pre-phase baseline. Phase 61 closes.

The five drifted anchors are carried forward as a separate gap-closure plan, tracked in the
Gaps section below and NOT treated as resolved. The suite stays at 2 failures until it lands.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Independent of the decision above, these are recorded and unclosed:

1. **The five drifted `.planning/` citations** — four line bumps and one deleted target. Needs a
   gap-closure plan whichever way the decision goes; option (a) defers it, option (b) blocks on it.
2. **WR-02** (`prereq-readme-gen.ts:229-256`, from 61-REVIEW.md) — `deriveEcosystemRows` dedups on
   the pair `(ecosystem, text)` while the audit's comparison maps key on `ecosystem` alone. Latent
   against today's declaration; a future edit giving one ecosystem id two different remedy texts
   would silently drop one side of a real divergence. A gap in the guard's totality.
3. **WR-01 / NUL-byte census** — `prereq-readme-gen.ts` joins three other files in `src/mcp/vice`
   carrying NUL bytes (`anno-memmap-render.ts`, `anno-store-export.ts`, `prerequisites.test.ts`).
   All four are `data` to `file(1)` and invisible to plain `grep`. CLAUDE.md documents one. The
   idiom is established prior art (`anno-store-export.ts:554`, phase 51), so the actionable item
   is the stale documented count, not the new code.
4. **`/gsd-secure-phase 61` not run** — `workflow.security_enforcement` is active and this phase
   has no SECURITY.md.
