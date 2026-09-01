---
phase: 16-packaging-and-repo-shape
verified: 2026-08-23T06:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Both published tarballs contain exactly the right files after the move — no test files leaked (Roadmap Success Criterion 1). Fixed by plan 16-08 (sync-skills.mjs filter + shared assertLeanTarball() inside packFiles()); re-verified live in this round with a plant-red/revert-green demonstration against the installer tarball, and both tarballs inspected directly via npm pack --dry-run --json (vice-mcp: 73 files, 0 leaks; c64-re-tools: 31 files, 0 leaks, 6 SKILL.md)."
  gaps_remaining: []
  regressions: []
---

# Phase 16: Packaging and Repo Shape Verification Report

**Phase Goal:** The plugin payload lives under `src/` with `.mcp.json` merged into any
consumer's existing config, and `QUAL-01..03` (tests for the three CLI scripts, orphaned
planning references, control-plane exposure) are closed.
**Verified:** 2026-08-23
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 16-08..16-11, plus a round-2 code review
that found and fixed two further defects, WR-05 and WR-06, in the gap-closure round's own
new guards).

## What Changed Since the Prior Verification

The prior round (`status: gaps_found`, 4/5) found exactly one blocking gap: Success
Criterion 1 was false for the `@henols/c64-re-tools` (installer) tarball — four committed
skill test files (`*.test.mjs`) shipped in it because `installer/scripts/sync-skills.mjs`
copied every file under each skill directory unfiltered, and `scripts/check-npm-packages.mjs`
only ever asserted the leak-free condition against the `@henols/vice-mcp` tarball. A
non-blocking WARNING also noted `REQUIREMENTS.md`'s PKG-04 checkbox/Traceability row still
read "Pending" despite the underlying disposition being fully verified.

Four gap-closure plans ran (16-08..16-11):
- **16-08** filtered `sync-skills.mjs` (excludes `*.test.mjs`, `test-corpus.mjs`,
  `fixtures/`) and moved the leak assertion (`assertLeanTarball()`) inside the shared
  `packFiles()` seam so both packages are checked by construction; also wired
  `installer/wire-mcp.test.mjs` and the four skill suites into CI's `build` job and added
  `ci-suite-coverage.test.ts` as a durability guard.
- **16-09** fixed two half-swept repo-root hop-chain comments (WR-02) and two synthetic
  scratch-directory shapes (IN-01), and added `hop-chain-comments.test.ts`.
- **16-10** fixed a CRITICAL finding (`16-REVIEW.md` CR-01): four consumer-facing generated
  strings/literals had been rewritten by the earlier `src/` relocation sweep to name this
  repository's own source tree instead of a consumer's installed location
  (`.claude/skills/...`), and added `skill-consumer-paths.test.ts` as a registry guard.
- **16-11** did close-out bookkeeping: flipped PKG-04's checkbox/Traceability row to
  `Complete`, added PKG-01's closure note, and recorded every decided-and-left item plus
  both spec-less-probe flagged assumptions in `16-GAP-CLOSURE-DECISIONS.md`.

A **round-2 code review**, scoped to the 18-file gap-closure delta (round 1 had already
reviewed all 98 phase files), then found two further warnings — both in the shape of this
phase's own recurring defect class, "a verification that cannot fail" — and both were fixed
in commit `f1fb821` rather than deferred:
- **WR-05**: `ci-suite-coverage.test.ts`'s `FROZEN_REGISTRY` proof check was a bare
  `step.includes("run: npm test")` substring, satisfied by any command merely starting with
  the proof (e.g. a silently narrowing `-- --test-name-pattern=...`). Replaced with an
  anchored `runsExactly()` regex.
- **WR-06**: `hop-chain-comments.test.ts` scanned only `src/mcp/vice/*.ts`/`*.mts`, so it was
  structurally blind to three `src/skills/*/scripts/*.mjs` files that still carried the
  exact half-swept-chain defect this guard exists to catch. The scan was widened
  (`enumeratedSkillScriptFiles()`), and all three sites (the review named two; the fix found
  a third, `dump-artifacts.test.mjs`, during a full sweep) were corrected.

This re-verification independently re-derived and live-exercised the fixes for both the
original gap and both round-2 findings, rather than trusting the SUMMARYs or the review
report. All checks below were run fresh against the current tree; three non-vacuity claims
were spot-checked with live plant-red/revert-green demonstrations of my own, matching (and in
one case exceeding — I found no discrepancy) what the SUMMARYs and `16-REVIEW-FIX.md` claim.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Both published tarballs contain exactly the right files after the move (`check-npm-packages.mjs` green, no `node_modules/`, no test files, no fixtures leaked, all six skills present) | ✓ VERIFIED | Direct `npm pack --dry-run --json` inspection (not just the validator's exit code): vice-mcp tarball 73 files, 0 test files, 0 fixtures, 0 node_modules — matches prior round. **c64-re-tools (installer) tarball: 31 files, 0 test files, 0 fixtures, 0 node_modules, all 6 `SKILL.md` present** — the prior round's 4-file leak is gone. Live plant-and-revert: temporarily neutered `sync-skills.mjs`'s `shouldCopy()` filter → `check-npm-packages.mjs` failed loudly naming exactly the 4 previously-leaked test files plus `test-corpus.mjs`; reverted → `git diff --stat` byte-identical, guard green again. `assertLeanTarball()` is confirmed to run from inside the shared `packFiles()` seam (read the source), so both packages are checked by the same code path, not two hand-maintained blocks. |
| 2 | `acme.mjs`, `driver.mjs` and `derive.mjs` each have a committed test file that runs and passes as part of the test suite | ✓ VERIFIED | `skill-acme-build-cli.test.ts`, `skill-memory-mapping-cli.test.ts`, `skill-program-recon-cli.test.ts` re-run live: 48/48 pass (`VICE_REQUIRE_ACME=1 node --test` on all three). Part of the full-suite run below as well. Unchanged since prior round; no regression. |
| 3 | A whole-tree grep gate proves zero orphaned planning references remain in source comments, demonstrated by biting on a planted violation before acceptance | ✓ VERIFIED | `comment-phase-pointers.test.ts` re-run live: 18/18 pass (up from 16/16 — this round added the fixture/coverage tests alongside it). `16-PKG03-GATE-PROOF.md`'s plant-and-revert record still holds; unchanged since prior round. |
| 4 | The emulator control-plane network exposure is either narrowed or recorded in PROJECT.md as an accepted risk with rationale | ✓ VERIFIED | `PROJECT.md` → Key Decisions still carries the dated (2026-08-22) PKG-04 row (unchanged, re-read in full this round). `REQUIREMENTS.md`'s PKG-04 entry is now `[x]` **and** its Traceability row reads `Complete` (closing the prior round's bookkeeping WARNING) — checked and confirmed to agree with each other and with PROJECT.md. The underlying fact was independently re-confirmed against the current (post-relocation) source: `vice-broker.mts:987` and `broker-control.mts:671` both still default `controlHost`/`host` to `"0.0.0.0"`. |
| 5 | `resources-sync.test.ts` and the byte-pinned per-backend tool manifests still pass after the relocation | ✓ VERIFIED | `node --test resources-sync.test.ts` re-run live: 2/2 pass. Unchanged since prior round. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts (gap-closure delta, this round)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `installer/scripts/sync-skills.mjs` | Filters test files/fixtures out of the copy | ✓ VERIFIED | `shouldCopy()` excludes `fixtures/`, `*.test.mjs`/`*.test.js`, `test-corpus.mjs`. Confirmed live: neutering the filter reintroduces the exact 4-file leak; the real filter excludes 5 entries per run. |
| `scripts/check-npm-packages.mjs` | Shared leak assertion for both packages | ✓ VERIFIED | `assertLeanTarball()` runs inside `packFiles()`, called once per package (`src/mcp/vice`, `installer`); a `packedNames`/`expectedPackedNames` pin prevents a third unchecked package. |
| `src/mcp/vice/ci-suite-coverage.test.ts` | Durability guard: every committed suite is proven to run in CI's `build` job | ✓ VERIFIED | 10/10 pass. `runsExactly()` (post-WR-05 fix) is anchored (`^\s*run:\s*npm test\s*$`), confirmed live to reject a planted `-- --test-name-pattern=...` narrowing on the real `ci.yml` (RED), then confirmed byte-identical revert + GREEN. |
| `src/mcp/vice/hop-chain-comments.test.ts` (+ fixture) | Guards against half-swept repo-root chain comments, scoped across both `src/mcp/vice` and `src/skills/*/scripts/*.mjs` | ✓ VERIFIED | 7/7 pass. Confirmed live: planting the pre-fix half-swept comment back into `watch-loads.test.mjs` (a file the pre-WR-06-fix guard could not see) produces a RED failure naming that exact file and line; reverted → byte-identical + GREEN. All three real sites (`diff-images.test.mjs`, `watch-loads.test.mjs`, `dump-artifacts.test.mjs`) independently confirmed to now read the correct `scripts -> skill -> skills -> src -> repo root` chain. |
| `src/mcp/vice/skill-consumer-paths.test.ts` | Registry guard: 4 consumer-facing literals name the installed path, never the source-tree path | ✓ VERIFIED | 12/12 pass. Read in full: every entry pairs a `required` (`.claude/skills/...`) substring check with a `forbidden` (`src/skills/...`) substring check — never a bare substring both forms satisfy, closing the exact defect class (`grep -c` on a shared substring) that let CR-01 ship originally. |
| `installer/wire-mcp.test.mjs`, `src/skills/*/scripts/*.test.mjs` | Wired into CI's `build` job, not just committed | ✓ VERIFIED | `.github/workflows/ci.yml` `build` job has `Test the installer` (`working-directory: installer`, `run: npm test`) and `Test the skills` (`run: node --test 'src/skills/*/scripts/*.test.mjs'`). Both invoked exactly as written: 18/18 and 89/97 (8 skipped, 0 fail) respectively. |
| `.planning/phases/16-packaging-and-repo-shape/16-GAP-CLOSURE-DECISIONS.md` | Decision register for this round | ✓ VERIFIED | Present, detailed; its Section 2 probe accounting (4 surfaced = 2 authored + 2 flagged) cross-checked directly against 16-08's and 16-09's own "Flagged Assumptions" sections and 16-08's/16-11's `must_haves.truths` — matches exactly. |
| `.planning/REQUIREMENTS.md` | PKG-01..04 checkboxes and Traceability rows agree with each other and with reality | ✓ VERIFIED | All four `[x]`, all four `Complete` in the Traceability table. PKG-01's closure note correctly names plans 16-08/16-10; PKG-04's correctly names 16-02/16-11. The "Control-Plane Bind Follow-on" section is a distinct, deliberately-still-open item (a future-milestone design question), not PKG-04 itself — confirmed it is not conflated with PKG-04's own closed status anywhere. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `installer/scripts/sync-skills.mjs`'s `cpSync(... , { filter: shouldCopy })` | `installer/skills/` | Direct filter argument | ✓ WIRED | Confirmed live: unfiltered copy reintroduces the leak; filtered copy excludes exactly 5 entries. |
| `scripts/check-npm-packages.mjs`'s `packFiles()` | `assertLeanTarball()` | Direct function call inside `packFiles()`, before `return` | ✓ WIRED | Read the source; called once per `packFiles()` invocation, both for `src/mcp/vice` and `installer`. |
| `.github/workflows/ci.yml` `build` job | `installer/wire-mcp.test.mjs` | `working-directory: installer` + `run: npm test` step | ✓ WIRED | Ran the exact command; 18/18 pass. |
| `.github/workflows/ci.yml` `build` job | `src/skills/*/scripts/*.test.mjs` | `run: node --test 'src/skills/*/scripts/*.test.mjs'` step | ✓ WIRED | Ran the exact command; 89 pass / 8 skipped / 0 fail. |
| `hop-chain-comments.test.ts`'s `corpusEntries()` | `src/skills/*/scripts/*.mjs` | `enumeratedSkillScriptFiles()` walking `join(HERE, "..", "..", "skills")` | ✓ WIRED | Confirmed live: planting a violation into a skill script the pre-fix guard could not see now produces a named failure. |
| `src/skills/c64-provenance-diff/scripts/diff-images.mjs`'s `renderLedger` | Emitted markdown string | Direct function call | ✓ FLOWING | Invoked `renderLedger()` directly with synthetic input; emitted string names `.claude/skills/c64-provenance-diff/scripts/diff-images.mjs`, never the `src/skills/...` form. |
| `src/skills/c64-ram-capture/scripts/watch-loads.mjs`'s `renderLoading` | Emitted markdown string | Direct function call | ✓ FLOWING | Invoked `renderLoading([])` directly; emitted string names both `.claude/skills/c64-ram-capture/scripts/watch-loads.mjs` and `.../dump-artifacts.mjs`. |
| `src/skills/acme-build/scripts/acme.mjs new` | Generated scaffold file's `; Build:` comment | Direct CLI invocation | ✓ FLOWING | Ran `node acme.mjs new /tmp/... --name testprog`; the written file's line 2 reads `; Build: node .claude/skills/acme-build/scripts/acme.mjs build THIS.a`. |

### Data-Flow Trace (Level 4)

All three consumer-facing generators/scaffolds above were exercised directly (not just grepped in source) and their emitted output inspected byte-for-byte — all name the consumer-installed `.claude/skills/...` path, none leak the `src/skills/...` source-tree form. This closes the exact class of defect (a `grep -c` on a shared substring "passing" on either path form) that let the original CR-01 regression ship undetected.

### Behavioral Spot-Checks / Live Command Runs (this round)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (run once) | `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` | 2386 tests / 24 suites / 2342 pass / 0 fail / 39 skipped / 5 todo | ✓ PASS (matches orchestrator-measured baseline exactly) |
| Typecheck | `cd src/mcp/vice && npm run typecheck` | exit 0 | ✓ PASS |
| Packaging validator | `node scripts/check-npm-packages.mjs` | exit 0, "OK" | ✓ PASS |
| Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | exit 0 | ✓ PASS |
| Skill fork honesty | `node scripts/check-skill-fork-honesty.mjs` | exit 0 | ✓ PASS |
| Plugin package build | `bash scripts/package.sh` | exit 0, 990 files | ✓ PASS |
| Installer test suite (as CI runs it) | `cd installer && npm test` | 18/18 pass | ✓ PASS |
| Skill test suites (as CI runs it) | `node --test 'src/skills/*/scripts/*.test.mjs'` | 97 tests / 89 pass / 0 fail / 8 skipped | ✓ PASS |
| Formerly-red guards, now green | `node --test docs-review-disposition.test.ts audit-integrity.test.ts` | 50/50 pass | ✓ PASS (deferred-items.md's predicted closure confirmed) |
| Direct tarball inspection (vice-mcp) | `npm pack --dry-run --json` in `src/mcp/vice` | 73 files, 0 leaks | ✓ PASS |
| Direct tarball inspection (c64-re-tools) | `npm pack --dry-run --json` in `installer` | **31 files, 0 test files, 0 fixtures, 6 SKILL.md** | ✓ PASS (was 36 files / 4 test files pre-fix) |
| **Plant-red/revert-green #1**: leak-assertion non-vacuity | Neutered `sync-skills.mjs`'s filter, ran `check-npm-packages.mjs`, reverted | RED (named exact 4 leaked files + `test-corpus.mjs`) → byte-identical revert → GREEN | ✓ PASS |
| **Plant-red/revert-green #2**: `ci-suite-coverage.test.ts` non-vacuity (WR-05 fix) | Planted `run: npm test -- --test-name-pattern=wireMcp` on real `ci.yml`'s installer step, ran guard, reverted | RED (1 fail, named `installer` unproven) → byte-identical revert → GREEN | ✓ PASS |
| **Plant-red/revert-green #3**: `hop-chain-comments.test.ts` non-vacuity (WR-06 fix) | Planted the old half-swept chain comment into `watch-loads.test.mjs`, ran guard, reverted | RED (1 fail, named exact file+line+text) → byte-identical revert → GREEN | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PKG-01 | 16-01, 16-03, 16-04, 16-05, 16-08, 16-10, 16-11 | Payload under `src/`, `.mcp.json` merged, tarballs correct | ✓ SATISFIED | Relocation, merge, AND tarball-correctness sub-clause all independently re-verified true this round. `REQUIREMENTS.md`'s closure note correctly names 16-08/16-10. |
| PKG-02 | 16-06 | `acme.mjs`/`driver.mjs`/`derive.mjs` tests | ✓ SATISFIED | 48/48 pass, wired into suite; durability confirmed via `ci-suite-coverage.test.ts`. |
| PKG-03 | 16-07, 16-09 | Orphaned planning references removed/guarded | ✓ SATISFIED | Phase-pointer guard (18/18) + hop-chain guard (7/7), both live-demonstrated red-then-green this round. |
| PKG-04 | 16-02, 16-11 | Control-plane exposure narrowed or accepted-risk documented | ✓ SATISFIED | PROJECT.md row + `16-PKG04-EVIDENCE.md` fully verified; `REQUIREMENTS.md` checkbox/Traceability now agree (prior WARNING closed). |

No orphaned requirements found — `REQUIREMENTS.md`'s "Packaging and Repo Shape" section names exactly PKG-01..04, matching all plan-declared requirement IDs across all 11 plans.

### Prohibitions (must_haves.prohibitions across the four gap-closure plans)

None of these plans' frontmatter uses the `{statement, status, verification}` object shape;
each declares plain prohibition strings. Treated here as judgment-tier. Rather than a purely
subjective LLM read, each was checked against concrete tool evidence gathered above:

| Prohibition (paraphrased) | Plan | Verdict | Evidence |
|---|---|---|---|
| Must not close the gap by weakening the gate/assertion/requirement text | 16-08, 16-09, 16-10 | HELD | The fix is in the leaking artifact (`sync-skills.mjs`'s filter) and in a genuinely stronger check (`assertLeanTarball()` inside the packing seam, `runsExactly()`'s anchored regex, widened `hop-chain-comments.test.ts` scan) — confirmed via three independent plant-red/revert-green demonstrations above, not by reading the claim. |
| Must not present an unexecuted committed suite as coverage | 16-08 | HELD | `installer/wire-mcp.test.mjs` and the skill suites are confirmed running inside CI's `build` job, invoked with the exact commands `ci.yml` uses. |
| Must not ship generated output instructing a consumer to run a nonexistent path | 16-10 | HELD | `renderLedger`, `renderLoading`, and `acme.mjs new`'s scaffold all directly exercised; emitted strings name only the consumer-installed path. |
| Must not use a bare substring both path forms satisfy | 16-10 | HELD | `skill-consumer-paths.test.ts`'s registry read in full — every entry pairs required+forbidden. |
| Must not rewrite historical narration into false present tense (hop-chain guard) | 16-09 | HELD | The guard's own in-tree negative control (`absorbed-answer-key.test.ts:34`) is confirmed seen-but-not-flagged; no historical-narration comment was altered. |
| Must not touch anything but the two scratch segment lists in `anno-regbits.test.ts` | 16-09 | HELD (not independently re-diffed this round; consistent with the passing `anno-regbits.test.ts` suite inside the full 2342-pass run) | |
| Must not add the new fixture to `files[]` or give it a `.ts`/`.mts` extension | 16-09 | HELD | `fixtures/planted-hop-chain-fixture.ts.txt` — confirmed non-`.ts`/`.mts` extension. |
| Must not rewrite the five repo-relative `D=`/`S=` SKILL.md assignments or `recovery-schema.mjs`'s `HERE` comment | 16-10 | HELD | All four SKILL.md quick-reference lines confirmed still reading `src/skills/...` (unchanged, per the deliberate decision recorded in `16-GAP-CLOSURE-DECISIONS.md` §1). |
| Must not change `renderLedger`/`renderLoading` behaviour beyond path literals | 16-10 | HELD (spot-checked via direct invocation; output structurally sane and matches the documented two-tier/absence-as-evidence shape) | |
| PKG-04/PKG-01 close-out must not weaken requirement wording | 16-11 | HELD | Both requirement descriptions unchanged in wording; only the checkbox/Traceability state changed, matching independently-verified fact. |
| Must not edit STATE.md/ROADMAP.md (plan-authored) | 16-11 | HELD | The only STATE.md/ROADMAP.md changes in the 16-08..16-11 commit range are the standard orchestrator "complete plan" bookkeeping commits (`0245bb5`, `b3eb5ad`, `c082d98`, `c0f093d`), not edits inside a plan's own task commits. |
| Must not mark DEBT-04/CORE-01 as anything but Phase-17-pending | 16-11 | HELD | `REQUIREMENTS.md`'s Traceability table still lists both as `Pending`/Phase 17. |

These verdicts are grounded in the tool evidence gathered in this report, not bare LLM
judgment alone — but per the honest-verifier protocol they are recorded explicitly rather
than silently folded into "passed," since no human has yet signed off on them individually.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` debt markers found in any of this round's new/modified files (`sync-skills.mjs`, `check-npm-packages.mjs`, `ci-suite-coverage.test.ts`, `hop-chain-comments.test.ts`, `skill-consumer-paths.test.ts`, the three consumer-path production files, `ci.yml`) | ℹ️ Info | Clean. (One `XXXX` match in `watch-loads.mjs` is a hex-digit format placeholder in a doc comment, not a debt marker.) |

### Human Verification Required

None. This is an infrastructure/tooling phase (packaging, CI wiring, guard tests) with no
user-facing elements — the infra carve-out applies. All five roadmap Success Criteria are
mechanically verifiable and were independently re-verified live in this round, including
three fresh plant-red/revert-green demonstrations of my own (not reused from the SUMMARYs).
No truth in this phase is a state-transition or cancellation/cleanup/ordering invariant, so
no ⚠️ PRESENT_BEHAVIOR_UNVERIFIED items exist. No non-inferable (`backstop`) truths were
present to abstain on.

### Gaps Summary

None. The prior round's single blocking gap (Success Criterion 1, the installer tarball test-
file leak) is closed and independently re-verified with a live plant-red/revert-green
demonstration, not merely a re-read of the green validator output. The prior round's
non-blocking WARNING (PKG-04's REQUIREMENTS.md bookkeeping) is also closed and confirmed
consistent. The round-2 code review's two findings (WR-05, WR-06) — both examples of exactly
this phase's own recurring "verification that cannot fail" defect class — were fixed, and
both fixes were independently re-derived and live-demonstrated in this verification round
rather than trusted from the review/fix reports.

---

_Verified: 2026-08-23_
_Verifier: Claude (gsd-verifier)_
