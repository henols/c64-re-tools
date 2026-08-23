---
phase: 16-packaging-and-repo-shape
fixed_at: 2026-08-23T02:00:00Z
review_path: .planning/phases/16-packaging-and-repo-shape/16-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 16: Code Review Fix Report (round 2)

**Fixed at:** 2026-08-23T02:00:00Z
**Source review:** `.planning/phases/16-packaging-and-repo-shape/16-REVIEW.md`
**Iteration:** 2 (round 1's report is archived at `16-REVIEW-round1-2026-08-23.md`; its
findings `CR-01`, `WR-01`, `WR-02`, `WR-03`, `WR-04`, `IN-01` were closed by gap-closure
plans `16-08`..`16-11` and are dispositioned in those plans' SUMMARYs)

**Summary:**
- Findings in scope: 2 (0 Critical + 2 Warning + 0 Info)
- Fixed: 2
- Skipped: 0

Round 2 reviewed the 18-file gap-closure delta produced by plans `16-08`..`16-11` — the
only code in this phase that round 1 had not already seen. Both findings were the defect
class this phase's gap-closure round exists to eliminate — *a verification that cannot
fail* — so both were fixed rather than deferred. Shipping the round with two known-toothless
guards would have left the phase in exactly the condition it was created to fix.

Both findings were re-verified against the tree before being fixed; neither was applied
blind. Round 2's `WR-06` named two sites, and re-verification found a **third** the review
had missed.

## Findings fixed

### WR-05 — `ci-suite-coverage.test.ts`'s proof check could not fail

**Site:** `src/mcp/vice/ci-suite-coverage.test.ts` (`checkCoverage`, `FROZEN_REGISTRY` branch)

The registry's "proof" that a directory's suite actually runs in CI was
`step.includes(\`run: ${proof}\`)` — a bare substring, so any command merely *starting*
with the proof satisfied it. `run: npm test -- --test-name-pattern=…`, a realistic way to
silently narrow what CI executes, counted as proof that the full suite runs. For the
`installer` registry entry this weak check was the only guard (the sibling
`ci-guardrails.test.mjs` has a properly anchored version, but only for `src/mcp/vice`).

**Fix:** replaced with a `runsExactly()` helper requiring the command to be the whole rest
of its physical line, generalizing the already-correct `/run:\s*npm test\b/` shape from
`ci-guardrails.test.mjs` so it also rejects trailing-argument variants. `proof` is
regex-escaped because it is registry data, not a pattern.

**Non-vacuity proof:** planted `run: npm test -- --test-name-pattern=wireMcp` on the real
`ci.yml`'s installer step → guard **RED**, naming `installer` as unproven ("registered, but
its proof substring was not found"). Reverted → `git diff --quiet` byte-identical, guard
**GREEN** (10/10). The pre-fix substring check returns `true` on that same planted line.

### WR-06 — `hop-chain-comments.test.ts` was blind to the files carrying the defect it forbids

**Sites:** `src/mcp/vice/hop-chain-comments.test.ts` (scan set);
`src/skills/c64-provenance-diff/scripts/diff-images.test.mjs`;
`src/skills/c64-ram-capture/scripts/watch-loads.test.mjs`;
**plus `src/skills/c64-ram-capture/scripts/dump-artifacts.test.mjs` — a third site the
review did not name**, found by sweeping the whole tree rather than fixing only the two
reported.

The guard scanned only `*.ts`/`*.mts` directly under `src/mcp/vice/`, so it structurally
could not see `src/skills/*/scripts/*.mjs` — and three of those files carried the very
half-swept chain (pre-relocation root segment left in as an intermediate hop) that this
guard was built in the same gap-closure round to eliminate.

**Fix, both halves:**
1. All three comments corrected to name their real ancestors. Each was verified by resolving
   four hops from the file's own directory and confirming it lands on the actual repository
   root — the comments now describe the tree that exists, and the hop count they annotate was
   already correct.
2. The scan widened via a new `enumeratedSkillScriptFiles()` and a `corpusEntries()` union, so
   the guard can see that half of the corpus at all. Skill-half entries are reported as
   repo-root-relative paths so a violation names the file unambiguously across both halves;
   module-half entries keep their bare basenames, preserving the existing exemption
   comparisons. Fixing only the three sites would have left the guard blind to the next one.

**Non-vacuity proof:** planted the half-swept chain back into
`src/skills/c64-ram-capture/scripts/watch-loads.test.mjs` — a file the pre-fix guard could
not see — → guard **RED**, naming `src/skills/c64-ram-capture/scripts/watch-loads.test.mjs:29`
and quoting the offending line. Reverted → guard **GREEN** (7/7).

**One consequence worth recording:** widening the scan made the guard flag its own new
documentation comment, which quoted the forbidden pattern verbatim. The assertion's own
failure message forbids per-file exemptions, and its predicate is per-physical-line, so the
comment was reworded so no single line carries the full shape — the same property
`repo-root.test.ts` already relies on. No exemption was added.

## Verification

All gates re-run live on the main checkout after the fixes (commit `f1fb821`):

| Gate | Result |
|---|---|
| `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` (full `*.test.*` glob, not the `test:automated` subset) | **2386 tests / 2342 pass / 0 fail** / 39 skipped / 5 todo / 24 suites |
| `cd src/mcp/vice && npm run typecheck` | clean, exit 0 |
| `node --test ci-suite-coverage.test.ts ci-guardrails.test.mjs hop-chain-comments.test.ts skill-consumer-paths.test.ts` | 48 pass / 0 fail |
| `node scripts/check-npm-packages.mjs` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 |
| `bash scripts/package.sh` | exit 0 |
| `cd installer && npm test` | 18/18 pass |

Fuller narrative context for this round, including the round-1 archive rationale and the
scoping decision, is in `16-GAP-CLOSURE-DECISIONS.md` § "Round-2 code review".
