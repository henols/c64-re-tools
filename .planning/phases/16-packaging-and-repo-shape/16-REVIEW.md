---
phase: 16-packaging-and-repo-shape
reviewed: 2026-08-23T03:18:34Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - installer/scripts/sync-skills.mjs
  - scripts/check-npm-packages.mjs
  - src/mcp/vice/ci-guardrails.test.mjs
  - src/mcp/vice/ci-suite-coverage.test.ts
  - src/mcp/vice/fixtures/planted-hop-chain-fixture.ts.txt
  - src/mcp/vice/hop-chain-comments.test.ts
  - src/mcp/vice/anno-regbits.test.ts
  - src/mcp/vice/anno-symbol-roundtrip.test.ts
  - src/mcp/vice/skill-acme-build-cli.test.ts
  - src/mcp/vice/skill-consumer-paths.test.ts
  - src/skills/acme-build/SKILL.md
  - src/skills/acme-build/template.a
  - src/skills/c64-provenance-diff/scripts/diff-images.mjs
  - src/skills/c64-provenance-diff/scripts/diff-images.test.mjs
  - src/skills/c64-ram-capture/scripts/watch-loads.mjs
  - src/skills/c64-ram-capture/scripts/watch-loads.test.mjs
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 16: Code Review Report (round 2, gap-closure delta)

**Reviewed:** 2026-08-23T03:18:34Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This is a round-2 review of the 18-file delta produced by gap-closure plans 16-08..16-11, which closed round 1's CR-01/WR-01..04/IN-01 findings (tarball leaks, unwired CI suites, consumer-path literal regressions, stale repo-root hop-chain comments). I re-derived and ran every new guard directly rather than trusting the SUMMARYs:

- `installer/scripts/sync-skills.mjs` + `scripts/check-npm-packages.mjs`: ran `node scripts/check-npm-packages.mjs` and inspected the generated `installer/skills/` tree by hand. The filter genuinely excludes `*.test.mjs`, `test-corpus.mjs` and any `fixtures/` directory while retaining `template.a` and all real skill assets; `assertLeanTarball()` genuinely runs from inside `packFiles()` for both packages, so a third package or a per-package special case cannot skip it. No leak found in either published tarball.
- `.github/workflows/ci.yml` + `ci-suite-coverage.test.ts` + `ci-guardrails.test.mjs`: confirmed `installer/wire-mcp.test.mjs` (18/18) and `src/skills/*/scripts/*.test.mjs` (89 pass / 8 skip) are now genuinely reachable from the `build` job (ran both invocations exactly as CI would), and that the guard suites pass against the real `ci.yml`. One weakness found in the new coverage guard's own proof-matching (WR-05 below).
- The four consumer-path literal sites (`diff-images.mjs`, `watch-loads.mjs`, `template.a`, `acme-build/SKILL.md`) plus their two guards (`skill-consumer-paths.test.ts`, plus the assertions embedded in `diff-images.test.mjs`/`watch-loads.test.mjs`): verified every required/forbidden substring against the actual file contents by hand (not just by reading the registry) and cross-checked the region-anchoring for `acme-build/SKILL.md`'s dual-route block. All four are correctly fixed and the presence+absence pairing is real, not vacuous.
- `hop-chain-comments.test.ts` + its fixture + `anno-symbol-roundtrip.test.ts`/`anno-regbits.test.ts`: ran the guard directly; its scan is correctly scoped to `*.ts`/`*.mts` files directly under `src/mcp/vice/`, the fixture drives both a positive and negative control, and `anno-symbol-roundtrip.test.ts`'s own hop-count comment is now correct (3 hops, `src/mcp/vice -> src/mcp -> src -> repo root`). However, this guard's directory scope is too narrow to see an identical defect class that still exists in two of the skill-script test files this same phase touched — see WR-06.

Two warnings, no blockers. Both are real, provable weaknesses in the new guard/test code itself (exactly the defect class this round-2 review was asked to scrutinise), not in the production skill scripts' behaviour.

## Warnings

### WR-05: `ci-suite-coverage.test.ts`'s FROZEN_REGISTRY proof match is an unanchored substring, not a real command check

**File:** `src/mcp/vice/ci-suite-coverage.test.ts:213-217`
**Issue:** `checkCoverage()` proves a `FROZEN_REGISTRY` directory ("src/mcp/vice", "installer") is covered by checking `step.includes(\`run: ${proof}\`)` where `proof` is the literal string `"npm test"`. This is a plain substring test with no word boundary or line-anchoring on either side. Confirmed live:

```
$ node -e '
const step = "      - name: Test\n        working-directory: src/mcp/vice\n        run: npm test -- --test-name-pattern=smoke\n";
console.log(step.includes("run: npm test"));   // true
'
true
```

Any step whose `run:` line is `npm test` *followed by anything* (extra flags after `--`, a name-pattern filter, a piped/chained command such as `npm test && echo done`) still satisfies this "proof", because `.includes()` only checks that the substring occurs somewhere in the step text — it does not anchor to end-of-line or word-boundary. A future edit that appends `-- --test-name-pattern=...` to the vice-mcp or installer `Test` step (a realistic way to silently narrow which tests actually run, since `node --test` forwards args after `--` to its own filter) would still report `unproven: []` / "covered" from this guard, exactly the "verification that cannot fail" defect class this gap-closure round exists to close. (For the specific `src/mcp/vice` full-glob-vs-`test:automated` narrowing this phase already worried about, `ci-guardrails.test.mjs`'s own `findRunStepBlocksForNpmTest`/`findRunStepBlocksForNarrowedGate` regexes are properly `\b`-anchored and would still catch it — but there is no equivalent narrowing guard for the `installer` entry, so for that directory this is the *only* guard, and it is vacuous against a suffix-appended narrowing.)
**Fix:** Anchor the proof check to the whole `run:` line, not a bare substring, e.g.:
```ts
const covered = steps.some((step) => {
  if (!step.includes(`working-directory: ${workingDirectory}`)) return false;
  return step.split("\n").some((line) => /^\s*run:\s*npm test\s*$/.test(line));
});
```
so an appended flag, filter, or chained command fails the proof instead of satisfying it by substring inclusion.

### WR-06: Two skill-script test files still carry the exact stale repo-root hop-chain comment `hop-chain-comments.test.ts` was written to eliminate — outside that guard's scan scope

**File:** `src/skills/c64-provenance-diff/scripts/diff-images.test.mjs:31`, `src/skills/c64-ram-capture/scripts/watch-loads.test.mjs:29`
**Issue:** Both files contain, verbatim:
```js
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");  // scripts -> skill -> skills -> .claude -> repo root
```
This is precisely the defect class `hop-chain-comments.test.ts` (added this same round) exists to catch: a chain-arrow comment naming the repository root that still carries the pre-relocation intermediate segment (`.claude`) phase 16-04 moved away from. The code itself is correct (4 `".."` hops from `<skill>/scripts/` to the repo root is unchanged whether the parent is `.claude/skills/` or `src/skills/`), but the comment's third hop should read `src`, not `.claude` — it currently sends a reader looking for `.claude/skills/...` on disk to a directory that has not existed since phase 16-04.

Grep confirms these are the only two occurrences and that `hop-chain-comments.test.ts`'s own `readdirSync(HERE)`-based scan (scoped to `*.ts`/`*.mts` files directly in `src/mcp/vice/`) is structurally unable to reach either file: both live under `src/skills/*/scripts/` as `.mjs`, two directory levels and a different extension away from that guard's corpus. This is not a bug in the guard (its scan-set decision is explicitly documented and deliberate for its own directory), but it means the exact regression class this phase spent a whole guard closing still has two live instances the guard cannot see, in files this same phase touched (both files gained new `skill-consumer-paths`-related assertions in this round).
**Fix:** Correct both comments to read `// scripts -> skill -> skills -> src -> repo root`. Optionally, extend `hop-chain-comments.test.ts`'s corpus (or add a sibling guard) to also scan `src/skills/**/*.mjs`, since this same half-swept-chain-comment defect class is not unique to `src/mcp/vice/`.

---

_Reviewed: 2026-08-23T03:18:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
