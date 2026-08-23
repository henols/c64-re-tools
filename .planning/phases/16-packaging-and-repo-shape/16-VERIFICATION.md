---
phase: 16-packaging-and-repo-shape
verified: 2026-08-23T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Both published tarballs contain exactly the right files after the move — no test files leaked (Roadmap Success Criterion 1)"
    status: partial
    reason: "`scripts/check-npm-packages.mjs` is green, but its test-file-leak assertion (`!vice.files.some(f => /\\.test\\.(ts|mts|mjs|js)$/.test(f))`) only runs against the @henols/vice-mcp tarball. It has no equivalent assertion for the @henols/c64-re-tools (installer) tarball. Empirically packing that tarball (`npm pack --dry-run --json` in installer/) shows 4 committed test files copied in verbatim by `sync-skills.mjs` (which does a recursive `cpSync` of each skill directory with no filtering): `skills/c64-provenance-diff/scripts/diff-images.test.mjs`, `skills/c64-ram-capture/scripts/d64-parse.test.mjs`, `skills/c64-ram-capture/scripts/dump-artifacts.test.mjs`, `skills/c64-ram-capture/scripts/watch-loads.test.mjs`. This condition pre-dates Phase 16 (present since the installer was added in commit 32edb28, unaffected by the `src/` relocation itself), but the roadmap's own Success Criterion 1 for THIS phase names 'no test files' as part of what must be TRUE after the move, and none of Phase 16's plans (16-01, 16-04) added a check for it in the installer tarball specifically."
    artifacts:
      - path: "scripts/check-npm-packages.mjs"
        issue: "Lines 58-63 assert no test files/fixtures/node_modules only for the vice.files (vice-mcp) tarball; the `inst` (c64-re-tools) tarball block at lines 194-200 checks only name, bin entry, 6 SKILL.md files, and node_modules absence — no test-file or fixture check at all."
      - path: "installer/scripts/sync-skills.mjs"
        issue: "cpSync(join(SRC, name), join(DEST, name), { recursive: true }) copies every file under each skill directory, including *.test.mjs files living beside the scripts they test, with no exclusion filter."
    missing:
      - "A test-file/fixture leak assertion for the installer (@henols/c64-re-tools) tarball inside check-npm-packages.mjs, mirroring the existing vice-mcp assertion."
      - "Either an exclusion filter in sync-skills.mjs (e.g. skip *.test.mjs) or a documented, deliberate decision that skill test files are meant to ship (with a PROJECT.md or REQUIREMENTS.md note), since currently neither is true — the leak is silent and unrecorded."
requirements_bookkeeping_note: "REQUIREMENTS.md (lines 207, 358) still lists PKG-04 as unchecked ('- [ ] **PKG-04**') and 'Pending' in the Traceability table, even though 16-02-SUMMARY.md's own frontmatter and PROJECT.md's Key Decisions table show PKG-04 fully disposed (accepted-risk row, dated 2026-08-22, with rationale, rejected narrow branch, and reversal criteria). 16-02-SUMMARY.md explicitly defers the checkbox flip to 'phase 16's close-out bookkeeping' — but none of plans 16-03 through 16-07 performed that bookkeeping, and no closure plan (e.g. a 16-08 in the shape of Phase 15's 15-12) exists in this phase. This is a documentation-consistency gap, not a technical failure of the underlying PKG-04 disposition (verified independently below) — recorded as a WARNING, not folded into the gaps list, because the actual roadmap Success Criterion 4 (exposure narrowed or documented as accepted risk) is independently verified TRUE against PROJECT.md and 16-PKG04-EVIDENCE.md."
---

# Phase 16: Packaging and Repo Shape Verification Report

**Phase Goal:** The plugin payload lives under `src/` with `.mcp.json` merged into any
consumer's existing config, and `QUAL-01..03` (tests for the three CLI scripts, orphaned
planning references, control-plane exposure) are closed.
**Verified:** 2026-08-23
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Both published tarballs contain exactly the right files after the move (`check-npm-packages.mjs` green, no `node_modules/`, no test files, no fixtures leaked, all six skills present) | ✗ FAILED (partial) | `check-npm-packages.mjs` exits 0 (verified live). vice-mcp tarball: 73 files, confirmed no test files/fixtures/`node_modules/` via direct `npm pack --dry-run --json` inspection. c64-re-tools tarball: 36 files, all 6 `SKILL.md` present, no `node_modules/` — **but** 4 committed test files (`diff-images.test.mjs`, `d64-parse.test.mjs`, `dump-artifacts.test.mjs`, `watch-loads.test.mjs`) are shipped inside `skills/*/scripts/`, confirmed by direct tarball inspection. The check script has no assertion covering this for the installer package. |
| 2 | `acme.mjs`, `driver.mjs` and `derive.mjs` each have a committed test file that runs and passes as part of the test suite | ✓ VERIFIED | `src/mcp/vice/skill-acme-build-cli.test.ts`, `skill-memory-mapping-cli.test.ts`, `skill-program-recon-cli.test.ts` exist, are discovered by the package's `*.test.*` glob, and pass live: 47/47 tests across the three files (`VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts skill-memory-mapping-cli.test.ts skill-program-recon-cli.test.ts` → `# pass 47 / # fail 0`). Confirmed real code paths exercised (subprocess CLI invocations + direct import of exported lookup function), not test-local reimplementations. |
| 3 | A whole-tree grep gate proves zero orphaned planning references remain in source comments, demonstrated by biting on a planted violation before acceptance | ✓ VERIFIED | `src/mcp/vice/comment-phase-pointers.test.ts` exists, runs live (`16/16 pass`), and `16-PKG03-GATE-PROOF.md` documents 4 live plant-and-revert demonstrations against the real tree (2 assignment-shape violations — line and block comment forms — 1 cut-phase reference, 1 negative control) each captured red-then-green, with `git diff --stat` confirming byte-identical reversion each time. `16-PKG03-CENSUS.md` backs the "15 sites fixed" claim. |
| 4 | The emulator control-plane network exposure is either narrowed or recorded in PROJECT.md as an accepted risk with rationale | ✓ VERIFIED | PROJECT.md → Key Decisions carries a dated (2026-08-22) PKG-04 row: names the `0.0.0.0` bind default across 5 cited sites, the rejected narrow-bind branch and why, the compensating control (256-bit CSPRNG token, `timingSafeEqual`, persisted mode-0600 `broker.json`), residual risk stated without softening, and a concrete reversal condition. `16-PKG04-EVIDENCE.md` grounds every claim in file:line citations and a live broker start (`ss -tln` showing `0.0.0.0:19510` bound). No source file under `src/mcp/vice` was edited to produce this evidence (`git diff --quiet` confirmed in the plan's own commits). |
| 5 | `resources-sync.test.ts` and the byte-pinned per-backend tool manifests still pass after the relocation | ✓ VERIFIED | `node --test resources-sync.test.ts` run live from `src/mcp/vice`: 2/2 pass. Part of the full-glob run below as well. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/skills/{acme-build,c64-memory-mapping,c64-program-recon,c64-provenance-diff,c64-ram-capture,vice-wedge-triage}/SKILL.md` | Six skill dirs relocated | ✓ VERIFIED | All 6 present; `.claude/skills` no longer exists |
| `src/mcp/vice/vice-proxy.ts`, `package.json`, `repo-root.ts`, `resources/vice-launcher.sh` | MCP server relocated | ✓ VERIFIED | All present; `.claude/mcp` no longer exists; typecheck green |
| `src/mcp/vice/skill-acme-build-cli.test.ts` | PKG-02 test | ✓ VERIFIED | Exists, 18 tests pass |
| `src/mcp/vice/skill-memory-mapping-cli.test.ts` | PKG-02 test | ✓ VERIFIED | Exists, non-vacuous, pass |
| `src/mcp/vice/skill-program-recon-cli.test.ts` | PKG-02 test | ✓ VERIFIED | Exists, pass |
| `src/mcp/vice/comment-phase-pointers.test.ts` | PKG-03 guard | ✓ VERIFIED | Exists, 16/16 pass, bites on plant (evidenced) |
| `src/mcp/vice/fixtures/planted-phase-pointer-fixture.ts.txt` | PKG-03 fixture | ✓ VERIFIED | Present, outside shipped-file scan |
| `.planning/phases/16-packaging-and-repo-shape/16-PKG03-GATE-PROOF.md`, `16-PKG03-CENSUS.md` | PKG-03 evidence | ✓ VERIFIED | Both present, detailed, internally consistent |
| `installer/wire-mcp.test.mjs` | PKG-01 `.mcp.json` merge tests | ✓ VERIFIED | Exists, 18/18 pass, imports real `wireMcp()`/`readJson()` from `bin/cli.mjs` (not reimplemented) |
| `.planning/phases/16-packaging-and-repo-shape/16-PKG04-EVIDENCE.md` | PKG-04 evidence | ✓ VERIFIED | Present, detailed, live-observed bind confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `installer/wire-mcp.test.mjs` | `installer/bin/cli.mjs` | `import { wireMcp, readJson } from "./bin/cli.mjs"` | ✓ WIRED | Confirmed real import, not a copy |
| `src/mcp/vice/*.test.ts` (package test glob `*.test.*`) | `skill-*-cli.test.ts` files | Node's non-recursive `node --test '*.test.*'` glob | ✓ WIRED | Confirmed discovered and run as part of full `npm test` |
| `.claude-plugin/plugin.json` `skills` field | `./src/skills/` | Direct field value | ✓ WIRED | Confirmed literal value `./src/skills/` |
| `scripts/package.sh` `mustNotExist` | old skill/MCP paths | Fail-closed check | ✓ WIRED | `mustNotExist = [".claude/skills", ".claude/mcp/vice"]`, neither exists — check passes meaningfully, not vacuously (both paths genuinely absent) |
| `installer/scripts/sync-skills.mjs` | `src/skills/` | `SRC = join(REPO_ROOT, "src", "skills")` | ✓ WIRED (but see gap) | Repointed correctly, but copies test files uncritically (pre-existing behavior, see gap 1) |

### Behavioral Spot-Checks / Live Command Runs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (run once, per constraint) | `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` | 2356 tests / 23 suites / 2312 pass / 0 fail / 39 skipped / 5 todo | ✓ PASS (matches orchestrator-measured baseline exactly) |
| Typecheck | `cd src/mcp/vice && npm run typecheck` | exit 0, no errors | ✓ PASS |
| Packaging validator | `node scripts/check-npm-packages.mjs` | exit 0, "OK" | ✓ PASS (but see gap 1 re: incomplete coverage) |
| Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | exit 0, 37 `vice_*` names, 10 `r2000_*` names | ✓ PASS |
| Skill fork honesty | `node scripts/check-skill-fork-honesty.mjs` | exit 0 | ✓ PASS |
| Plugin package build | `bash scripts/package.sh` | exit 0, 972 files | ✓ PASS |
| Installer test suite | `cd installer && npm test` | 18/18 pass | ✓ PASS |
| Three new CLI test files | `VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts skill-memory-mapping-cli.test.ts skill-program-recon-cli.test.ts` | 47/47 pass | ✓ PASS |
| PKG-03 guard | `node --test comment-phase-pointers.test.ts` | 16/16 pass | ✓ PASS |
| resources-sync guard | `node --test resources-sync.test.ts` | 2/2 pass | ✓ PASS |
| repo-root hop-count guard | `node --test repo-root.test.ts` | 6/6 pass | ✓ PASS |
| Direct tarball inspection (vice-mcp) | `npm pack --dry-run --json` in `src/mcp/vice` | 73 files, no `node_modules`, no test files, no fixtures | ✓ PASS |
| Direct tarball inspection (c64-re-tools) | `npm pack --dry-run --json` in `installer` | 36 files, 6 skills, no `node_modules` — **4 test files present** | ✗ FAIL (see gap 1) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PKG-01 | 16-01, 16-03, 16-04, 16-05 | Payload under `src/`, `.mcp.json` merged, tarballs correct | ⚠️ PARTIAL | Relocation and merge fully verified; tarball-correctness sub-clause fails for the installer package (gap 1) |
| PKG-02 | 16-06 | `acme.mjs`/`driver.mjs`/`derive.mjs` tests | ✓ SATISFIED | 47/47 tests pass, wired into suite |
| PKG-03 | 16-07 | Orphaned planning references removed/guarded | ✓ SATISFIED | Guard live, bites on plant, 15 sites fixed |
| PKG-04 | 16-02 | Control-plane exposure narrowed or accepted-risk documented | ✓ SATISFIED (technical) / ⚠️ bookkeeping gap | PROJECT.md row + evidence doc fully verified; REQUIREMENTS.md checkbox/traceability still shows "Pending" — see `requirements_bookkeeping_note` in frontmatter |

No orphaned requirements found — REQUIREMENTS.md's "Packaging and Repo Shape" section names exactly PKG-01..04, matching all four plan-declared requirement IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the phase's key new/modified test files | ℹ️ Info | Clean |
| `installer/scripts/sync-skills.mjs` | 35-37 | Unfiltered recursive copy ships `*.test.mjs` files into the published tarball | ⚠️ Warning | Root cause of gap 1 — pre-existing, not introduced by this phase, but unaddressed by it |

### Human Verification Required

None. All must-haves for this phase are either mechanically verifiable (and were verified live) or already resolved by documented, evidence-grounded decisions (PKG-04).

### Gaps Summary

One gap blocks a clean pass: **Success Criterion 1** ("both published tarballs contain exactly
the right files … no test files … leaked") is not actually true for the `@henols/c64-re-tools`
tarball. `check-npm-packages.mjs` reports green because its test-file-leak assertion only
inspects the `@henols/vice-mcp` package; it has no equivalent check for the installer package.
Direct inspection of `npm pack --dry-run --json` output for `installer/` shows four committed
test files copied in via `sync-skills.mjs`'s unfiltered `cpSync`. This condition pre-dates Phase
16 (traced to the installer's original commit, unaffected by the `src/` relocation itself), but
the roadmap's own Success Criterion 1 for this phase explicitly requires "no test files" to hold
across both tarballs, and none of the phase's plans added a check or a fix for the installer side.

A second, non-blocking item is recorded as a WARNING rather than a gap: REQUIREMENTS.md's PKG-04
checkbox and traceability-table row still read "Pending"/unchecked, even though the underlying
PKG-04 disposition (documented accepted risk in PROJECT.md) is independently and fully verified.
16-02-SUMMARY.md explicitly deferred this bookkeeping to "phase 16's close-out," but no phase-16
closure plan performed it.

**This looks intentional in the sense that the test-file leak is old, pre-existing behavior — but
no override has been recorded for it.** To accept this deviation instead of fixing it, add to this
file's frontmatter:

```yaml
overrides:
  - must_have: "Both published tarballs contain exactly the right files after the move — no test files leaked"
    reason: "The test-file leak into the c64-re-tools tarball pre-dates Phase 16 and is unrelated to the src/ relocation; scope narrowed to the vice-mcp tarball and the relocation-specific checks."
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

Absent that override, the recommended fix is small: add a test-file/fixture assertion for the
`inst` block in `check-npm-packages.mjs` (mirroring the existing `vice.files` assertion), and
either exclude `*.test.mjs` in `sync-skills.mjs`'s copy or explicitly decide skill test files
should ship (and document why).

---

_Verified: 2026-08-23_
_Verifier: Claude (gsd-verifier)_
