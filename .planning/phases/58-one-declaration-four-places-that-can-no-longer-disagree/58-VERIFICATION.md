---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
verified: 2026-09-17T00:00:00Z
status: gaps_found
score: 3/5 roadmap success criteria verified
behavior_unverified: 1
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-01-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-01-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-02-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-02-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-REVIEW.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-VALIDATION.md"
  - "README.md"
  - "docs/phase58-declaration-provenance.md"
  - "src/mcp/vice/package.json"
  - "src/mcp/vice/prerequisites.json"
  - "src/mcp/vice/prerequisites.test.ts"
covered_digest: "v1:sha256:bb145688f0c4f6b9d97cd5fa09baf9385a837a9c2befaadd061d0844514dd060"
overrides_applied: 0
gaps:
  - truth: "SC5 — No remedy text is invented at authoring time; every disagreement between two sources is recorded with which one was chosen and why, and every citation names an artifact that actually says what is claimed"
    status: partial
    reason: >-
      The substance of `docs/phase58-declaration-provenance.md`'s worked cases is correct (the
      reasoning behind each provenance grade and each source conflict is sound), but two of the
      document's `file:line` citations point at the wrong location and, read literally, cite the
      wrong evidence for the claim they support. Both were already caught and documented,
      unfixed, in the phase's own committed 58-REVIEW.md (WR-01, WR-02), and I independently
      re-confirmed both against the source: (1) `.planning/REQUIREMENTS.md:88` is cited twice
      (provenance doc lines 35 and 42) as the record that "no shipped tool refuses on" the VICE
      version gate; that exact sentence is actually at `REQUIREMENTS.md:85` — line 88 is an
      unrelated row about README byte-identical guarding. (2) `.github/workflows/ci.yml:70-72`
      is cited (provenance doc line 102) as the banner-grep step that promotes the ACME entry to
      `measured`; lines 70-72 are inside the `retry_apt()` helper's failure-echo branch
      (`echo "retry_apt: attempt..."`, `sleep 5`), not the banner grep, which actually runs at
      `ci.yml:80-81`. The plan's own acceptance criteria for this doc only assert that a cited
      path exists on disk, not that the cited line says what is claimed, so these defects passed
      the plan's own automated `<verify>` blocks and were only caught by code review.
    artifacts:
      - path: "docs/phase58-declaration-provenance.md"
        issue: "Case one (lines 35, 42) cites REQUIREMENTS.md:88 instead of :85; Case three (line 102) cites ci.yml:70-72 instead of :80-81 (or :50-51 if citing the descriptive comment)"
    missing:
      - "Correct both REQUIREMENTS.md:88 occurrences in docs/phase58-declaration-provenance.md to REQUIREMENTS.md:85"
      - "Correct the ci.yml:70-72 citation in docs/phase58-declaration-provenance.md to ci.yml:80-81"
deferred: []
advisory:
  - finding: "`prerequisites.json` omits a ninth genuine, user-installed external tool: `unp64`, the packer-identification oracle resolved via `UNP64`/`UNP64_PATH` in `resolveOracleCommand()` (src/mcp/vice/host-tool.mts, DEFAULT_ORACLE_COMMAND at line 2792) and documented as a host install step in `src/skills/c64-program-recon/SKILL.md`. Its two HOST_TOOL_IDS members, `oracle.probe` and `oracle.run`, are attributed to the `node` record's `unblocks.mcp` instead of a dedicated `unp64` record."
    category: architectural
    reason: >-
      Already flagged independently by the checked-in 58-REVIEW.md (WR-03) and confirmed by me
      against the source. I am not treating this as a gap against this phase's own contract:
      ROADMAP.md's Success Criterion 1 for DECL-01 is a closed, itemized list — "covering
      `x64sc`, `c1541`, `petcat`, the ACME binary, ACME's standard library, Ghidra, dxa and
      Node" — that does not name `unp64`, and `prerequisites.test.ts`'s required-id assertion
      (a subset relation) matches that closed list exactly. `unp64` has also historically been
      treated in this codebase as an optional, live-gated external oracle whose absence is an
      expected, visibly-skipped state (19-DECISIONS.md decision 3), qualitatively different from
      the eight load-bearing tools this phase declares. The concern is real for the milestone's
      broader "every prerequisite" framing and for what Phase 60/61 build on this file, so it is
      recorded here for a human decision on whether to add a ninth record now or explicitly scope
      it to a later phase — not asserted as a failure of this phase's own success criteria.
    evidence_status: "confirmed against source (host-tool.mts:2792-2835, src/skills/c64-program-recon/SKILL.md); not yet added to prerequisites.json"
behavior_unverified_items:
  - truth: "SC2 — the declaration is proven to parse under the oldest Node the doctor must start on, by a dedicated CI job (decl-02-node18-proof) on a real GitHub Actions runner"
    test: "Push this branch's commits to origin (currently 9 commits ahead of origin/main, none pushed) and open the Actions run for the push; confirm the decl-02-node18-proof job appears and completes green."
    expected: "The job resolves Node 18 via actions/setup-node@v4 with no package-manager install, and its run step reports `prerequisites.json parsed on Node 18 -- 8 tool record(s)` with exit 0."
    why_human: "This is a real-runner execution outcome, not something a local process can observe. The plan itself flags this as an unresolved, manual-only verification (58-VALIDATION.md's Manual-Only Verifications table, and 58-01-PLAN.md's own 'Flagged Planner Assumptions' section for DECL-02) rather than claiming it as covered. A local Node 18 binary parsing the file (confirmed below) and the YAML structure being correctly wired are necessary but not sufficient evidence that the runner itself executes the job green."
human_verification:
  - test: "Push the phase 58 commits (4f3e0779..dc9535ce) to origin and confirm the new decl-02-node18-proof CI job runs and passes on a real GitHub Actions runner."
    expected: "Job completes with exit 0 and the console output contains 'prerequisites.json parsed on Node 18 -- 8 tool record(s)'."
    why_human: "No GitHub Actions runner is reachable from this verification session; this is the one piece of DECL-02's evidence chain that only a real push can produce."
  - test: "Decide whether `unp64` (the packer-identification oracle) should be added as a ninth `prerequisites.json` record now, or explicitly deferred to a later phase in writing."
    expected: "Either a `unp64` record is added (with prerequisites.test.ts's required-id set extended to include it), or a decision record states it is out of scope for this milestone's prerequisite declaration and why."
    why_human: "This is a scope call — ROADMAP SC1's closed 8-item list does not include unp64, but the phase's own headline goal language ('every prerequisite') and the code review's WR-03 finding both bear on it. Only the project owner can decide whether the closed list was deliberate or an oversight."
---

# Phase 58: One Declaration, Four Places That Can No Longer Disagree — Verification Report

**Phase Goal:** Every prerequisite described once — what it unblocks and the remedy per platform
— in plain JSON a Node too old to run the server can still parse, and present in the published
package.
**Verified:** 2026-09-17
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, the authoritative contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — One committed declaration names every prerequisite in the closed set (x64sc, c1541, petcat, ACME binary, ACME lib, Ghidra, dxa, Node), each with id/unblocks/remedies-per-platform (DECL-01) | ✓ VERIFIED | `src/mcp/vice/prerequisites.json` contains exactly these eight keys; `prerequisites.test.ts` (20/20 pass, re-run live) asserts id-equals-key, closed unblocks vocabularies, platform-key closure, and remedy field completeness for all eight |
| 2 | SC2 — Plain JSON, no new runtime dependency, proven to parse under the oldest Node the doctor must start on via a dedicated CI job (DECL-02) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Local re-verification: a real Node v18.20.8 binary `JSON.parse`s the file and reports 8 tools; `.github/workflows/ci.yml` declares `decl-02-node18-proof` wired through `actions/setup-node@v4` node-version `"18"` with zero `needs:` edges added or changed on any pre-existing job (independently diffed against base commit `d0e9fb2e`). The job has never executed on a real runner — local `git log` shows the branch 9 commits ahead of `origin/main` with nothing pushed |
| 3 | SC3 — Node is the only record carrying a version floor, non-vacuously tested (DECL-04) | ✓ VERIFIED | `tools.node.versionFloor` (`>=24.0.0`) is byte-equal to `package.json`'s `engines.node`; `assertNoStrayVersionFloor`'s planted-violation case (subtest 16) is observed being rejected while the real document (subtest 15) passes |
| 4 | SC4 — Declaration ships in the published tarball, proven via the tarball's own file list, not a repo-path check (DECL-05) | ✓ VERIFIED | `prerequisites.json` is in `package.json`'s `files[]`; the named script `scripts/check-npm-packages.mjs` was retired project-wide same-day (commit `d0e9fb2e`, unrelated to this plan) — the executor substituted a colocated `npm pack --dry-run --json`-based test case (subtest 20, "packaging (DECL-05)") that preserves the exact non-vacuous, tarball-list mechanism. Confirmed the substitute genuinely reads the packed list, not `existsSync` |
| 5 | SC5 — No remedy invented; every disagreement between two sources is recorded, with which one was chosen and why, and every citation names an artifact that actually says what is claimed | ✗ FAILED (partial) | `docs/phase58-declaration-provenance.md` exists with 7 sections covering all five worked cases named in the plan, and the reasoning in each is substantively correct — but two `file:line` citations point at the wrong location for the evidence they claim to support (see Gaps below). Both were independently re-confirmed against source, matching the already-committed 58-REVIEW.md's WR-01/WR-02 exactly |

**Score:** 3/5 roadmap success criteria verified (1 present-but-behavior-unverified, 1 failed on citation accuracy)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DECL-01 | 58-01, 58-02 | One declaration names every prerequisite in the closed set, with unblocks + remedies + provenance reasoning | ⚠️ PARTIAL | JSON structure and its 20-case test suite fully sound; the provenance doc's reasoning is substantively correct but carries two wrong citations (see gap) |
| DECL-02 | 58-01 | Plain JSON, parses under the oldest Node floor, proven by CI | ⚠️ PARTIAL | Local Node 18 parse and CI wiring verified; real-runner green execution unobserved (never pushed) |
| DECL-04 | 58-01 | Node is the only version-floor record, non-vacuously guarded | ✓ SATISFIED | Byte-equality + planted-violation test both re-run and pass |
| DECL-05 | 58-01 | Declaration ships in the published tarball | ✓ SATISFIED | Substituted test-based mechanism verified functionally equivalent to the plan's named (now-retired) script |

No orphaned requirements: REQUIREMENTS.md's traceability table lists exactly these four IDs against Phase 58, matching both plans' `requirements:` frontmatter.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/prerequisites.json` | Eight-record declaration | ✓ VERIFIED | Exists, valid JSON, all eight keys present, structurally validated by its own test suite |
| `src/mcp/vice/prerequisites.test.ts` | Structural gate, 4 validators + planted-violation cases | ✓ VERIFIED | 362 lines, 20 test cases, all pass on live re-run; not in `test-gate.mjs`'s `MANUAL_ONLY_TESTS` (confirmed by grep — zero matches) |
| `src/mcp/vice/package.json` | `files[]` includes `prerequisites.json` | ✓ VERIFIED | Confirmed present at line 68, beside `anno-regbits.json` |
| `.github/workflows/ci.yml` | New Node-18 CI job, pre-existing jobs untouched | ✓ VERIFIED | `decl-02-node18-proof` job present and correctly shaped; diff against base commit shows zero `needs:` changes and one job added |
| `docs/phase58-declaration-provenance.md` | Human-readable provenance record, 6+ sections | ⚠️ PARTIAL | Exists, 7 sections, correct substance, 2 wrong citations (gap) |
| `README.md` | Corrected VICE-version prose, table byte-unchanged | ✓ VERIFIED | Rewritten section cites REQUIREMENTS.md and prerequisites.json, names the text-channel route; table region confirmed byte-identical to HEAD by diff |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `prerequisites.json` remedy `text` | Four in-tree sources (README table, SKILL.md, host-tool.mts refusals, vice-launcher.sh) | Byte-for-byte / faithfully-paraphrased carry with `source` citation | ✓ WIRED | Spot-checked debian-trixie/README:101, dxa/host-tool.mts:1472, acme-lib/SKILL.md:255, ghidra/host-tool.mts:1352, node/vice-launcher.sh:219 — all match |
| `tools.node.versionFloor` | `package.json`'s `engines.node` | Byte-equality test | ✓ WIRED | Subtest 9 passes; both values are `>=24.0.0` |
| `package.json` `files[]` | Packed tarball's own file list | `npm pack --dry-run --json` read inside `prerequisites.test.ts` | ✓ WIRED | Subtest 20 passes; confirmed the assertion reads the packed list, not `existsSync` |
| `prerequisites.test.ts` | `test-gate.mjs`'s `MANUAL_ONLY_TESTS` | Must stay excluded | ✓ WIRED | `MANUAL_ONLY_TESTS` (12 frozen entries) contains no `prerequisites` reference |
| Provenance doc citations | The files/lines they claim to quote | `file:line` pointers | ✗ PARTIAL | 2 of the doc's citations point at the wrong line (see gap); the rest, spot-checked, resolve correctly |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| All 20 structural tests pass | `node --test --test-reporter=tap prerequisites.test.ts` | `# pass 20`, `# fail 0` | ✓ PASS |
| Real Node 18 parses the declaration | `node18 -e 'JSON.parse(...)'` | `NODE18_PARSE_OK tools=8` | ✓ PASS |
| CI YAML structurally sound, pre-existing jobs untouched | `python3 -c "yaml.safe_load(...)"` diff against `d0e9fb2e` | `preexisting_needs_changed=[]`, `added=['decl-02-node18-proof']` | ✓ PASS |
| README install table byte-unchanged | region extraction + diff against HEAD | (verified by inspection; region matches plan's own described byte-identity requirement) | ✓ PASS |
| New CI job actually executes on a GitHub Actions runner | N/A — no runner reachable from this session | not run | ? SKIP (routed to human verification) |

### Anti-Patterns Found

None of TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in any of the phase's modified files. No debt-marker gate triggered.

### Additional Findings (from independently-confirmed, already-committed code review)

- **WR-01, WR-02 (confirmed, unfixed):** wrong `file:line` citations in `docs/phase58-declaration-provenance.md` — see Gap above.
- **WR-03 (confirmed, advisory — see `advisory:` frontmatter):** `unp64` prerequisite omitted from the declaration. Not treated as a gap against this phase's own ROADMAP-scoped success criteria (a closed 8-tool list), but flagged for a human scope decision given the phase's broader "every prerequisite" framing.
- **IN-01 (confirmed, informational, not gating):** the `acme` record's one `measured` remedy text (`sudo apt-get install -y acme`) is a reasonable human-facing simplification of the actual CI line (`retry_apt install -y acme`, which expands to an `apt-get` call with retry flags) — the simplification is defensible but means "measured" here does not mean byte-identical-to-CI-script the way it does for the `x64sc`/README parity case.

### Human Verification Required

1. **CI job real-runner execution** — push the phase 58 commits and confirm `decl-02-node18-proof` runs green on GitHub Actions. Expected: exit 0, output containing `prerequisites.json parsed on Node 18 -- 8 tool record(s)`. Why human: no runner reachable from this session; explicitly flagged as manual-only by the plan itself.
2. **unp64 scope decision** — decide whether to add a ninth `unp64` record now or record an explicit deferral. Why human: a scope call between the ROADMAP's closed 8-item SC1 list and the phase's broader "every prerequisite" framing; only the project owner can settle it.

### Gaps Summary

The core technical deliverable — the JSON declaration itself, its 20-case structural test suite,
the `files[]`/packaging proof, the version-floor guard, and the Node-18 CI wiring — is solid,
independently re-verified, and matches every acceptance criterion in both plans. The one
substantive gap is narrow and cheap to close: two `file:line` citations in the supporting
provenance document point at the wrong location for the evidence they cite. Both were already
caught by this phase's own committed code review (`58-REVIEW.md`, WR-01/WR-02) and remain
unfixed as of the last commit (`dc9535ce`, which only added the review report). Because the
provenance document's entire purpose is to be a trustworthy, falsifiable citation ledger — and
because the plan's own acceptance criteria only check that a cited path exists, not that the
cited line says what is claimed — this is exactly the class of defect a mechanical check cannot
catch and a verifier should not wave through. The fix is a two-line edit to
`docs/phase58-declaration-provenance.md`. Separately, `unp64`'s omission (WR-03) is recorded as
an advisory scope question rather than a gap, since the ROADMAP's own Success Criterion 1 closes
the tool list at eight and does not name it.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
