---
phase: "35"
slug: "dxa-vendored-and-parsed"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-04"
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `35-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled by `/gsd-validate-phase` once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json:58`'s `test` script is the whole config |
| **Quick run command** | `cd src/mcp/vice && node --test dxa-listing.test.ts dxa-partition.test.ts hostpath-consumers.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~5s quick · ~3min full |

**Recorded baseline, not a gate.** `npm run test:automated` does not start from
zero failures. The last recorded floor is **2 failing tests in 1 file
(2026-09-03, one named bookkeeping cause)**; an earlier record read 5-in-3
(2026-09-02). Do **not** pin either number in an assertion — **measure the floor
immediately before the phase's first commit and again after the last**, and
record both readings. A residual failure at the measured baseline is not caused
by this phase.

**Two known environment effects on the suite:**

- A **live VICE broker deterministically reds the BACK-05 test.** Stop the broker
  before trusting any suite result.
- `npm test` (the full glob) **blocks indefinitely** on `vice-proxy.test.ts`.
  Use `test:automated` for all routine sampling; it skips the
  `MANUAL_ONLY_TESTS` set (exactly nine files today, a reviewed decision).

---

## Sampling Rate

- **After every task commit:** the quick run command, scoped to the files touched
- **After every plan wave:** `npm run test:automated`, compared against the measured baseline
- **Before `/gsd-verify-work`:** `test:automated` at baseline, plus `npm run typecheck`
  and `node scripts/check-npm-packages.mjs` both green
- **Max feedback latency:** ~5 seconds (quick), ~180 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → test route (from RESEARCH.md § Validation Architecture)

| Req ID | Behaviour | Test Type | Route | File Exists? |
|--------|-----------|-----------|-------|-------------|
| DXA-01 | Digest gate written **before** the fetch; `sha256` re-verified against Phase 23's pin; build reproduces the pinned binary digest | integration (build-gated) | `dxa-build-gate.test.ts` (new) — the honesty check is a **digest**, never "did it exit 0" | ❌ Wave 0 |
| DXA-01 | `THIRD-PARTY-NOTICES.md` quotes the GPL-2.0-or-later header verbatim and **no longer claims "No GPL-licensed material is incorporated"** | structural | `third-party-notices.test.ts` (new, or extend an existing notices test — confirm first) | ❌ Wave 0 |
| DXA-02 | Parser accounts for exactly the 5 measured `-a dump` line shapes; **refuses by name** on byte-total mismatch | unit | `dxa-listing.test.ts` (new) | ❌ Wave 0 |
| DXA-02 | Refusal provoked by a **real** unknown form from a real corpus run, not only a planted truncation | manual/live (needs built dxa + real image) | `MANUAL_ONLY_TESTS` entry — mirrors `fork-live.test.ts` / `stock-live.test.ts` (default-SKIP, opt-in via env var) | ❌ Wave 0 |
| DXA-02 | Overlapping decode (`jsr` into a mid-instruction target) yields `unclassified` **with a stated reason**, never a winner | unit | `dxa-listing.test.ts` (synthetic overlapping-decode fixture) | ❌ Wave 0 |
| DXA-03 | `-B`/`-l` emitter reads the store's 12-member vocabulary; excluded ranges **absent from dxa's own classification output** on a real image | integration (needs built dxa) | `MANUAL_ONLY_TESTS` entry — must inspect dxa's listing, not merely that the `-B` file parsed | ❌ Wave 0 |
| DXA-04 | Partition script's fixture tier reproduces Phase 23's already-independently-derived `FIXTURE_*` numbers exactly | unit | `dxa-partition.test.ts` (new) | ❌ Wave 0 |
| DXA-04 | Partition script's byte-derived tier classifies a synthetic BASIC-stub `.prg` and reports **everything else `unknown`** rather than guessing | unit | `dxa-partition.test.ts` (new) | ❌ Wave 0 |
| SEAM-06 (carried, Phase 34) | `dxa-listing.ts` / `dxa-run.ts` never import `hostpath.ts`; `HOST_TOOL_FAMILY_FLOOR` raised from 3 to 5 in the **same commit** that lands them | structural | `hostpath-consumers.test.ts:507-518` (exists; already names both files by anticipation — passes vacuously until they exist, then must still pass) | ✅ exists |

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/dxa-listing.test.ts` — DXA-02 (5 line shapes, named refusal, overlapping-decode `unclassified`)
- [ ] `src/mcp/vice/dxa-partition.test.ts` — DXA-04 (fixture-tier reproduction, byte-derived-tier BASIC-stub classification, `unknown` elsewhere)
- [ ] `src/mcp/vice/dxa-build-gate.test.ts` — DXA-01 (digest gate written before fetch, re-verified `sha256`, build-reproduces-pinned-digest; structured as a script the test invokes, **not** a live network fetch inside the test)
- [ ] One `MANUAL_ONLY_TESTS` entry (name set by the plan) for everything needing a built dxa binary and a real corpus image — must be added to the `MANUAL_ONLY_TESTS` list in the **same commit** as the file, or it runs inside `test:automated` on machines with no dxa build
- [ ] Framework install: **none** — Node's built-in runner already covers this phase

**Placement guard:** keep every committed test under `src/mcp/vice/`, **not**
under `vendor/dxa/`. `ci-suite-coverage.test.ts` has no `vendor` skip and reds
on a committed test file in a directory with no matching `ci.yml` step. It also
descends into `.claude/worktrees/agent-*/`, so measure test counts **after**
wave cleanup, never during.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parser refuses a **real** unknown listing form | DXA-02 | A unit test's input is synthetic by construction, so it structurally cannot satisfy "provoked by a real unknown form from an actual run". This is not decoration — it is the one piece of evidence the automated tier cannot supply. | Build the vendored dxa, run `-a dump` over a real corpus image, feed the listing to the parser, capture the refusal by name and the offending line verbatim into the phase evidence directory |
| `-b` data-block exclusion on a real image | DXA-03 | Requires a built dxa binary; the criterion is "excluded from discovery", observable only in dxa's own post-hoc listing | Emit `-B`/`-l` from the store's 12-member vocabulary, run dxa with the block file, assert the named ranges carry no classification in the resulting listing |
| Reproducible-build digest match | DXA-01 | Requires a network fetch and a full C build; must not run inside the unit suite | Run the committed build script, compare the produced binary's `sha256` against the pin, record both digests |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] Baseline measured before first commit **and** after last commit, both recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
