---
phase: 16
slug: packaging-and-repo-shape
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-22
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `16-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` (via `node --test`) — no separate test framework |
| **Config file** | `.claude/mcp/vice/tsconfig.json` (typecheck-only; post-move `src/mcp/vice/tsconfig.json`) |
| **Quick run command** | `npm run test:automated` (from the vice-mcp package directory) |
| **Full suite command** | `VICE_REQUIRE_ACME=1 npm test` (the `*.test.*` glob CI actually runs — deliberately wider than `test:automated`) |
| **Estimated runtime** | ~60–180 seconds for the full glob |

> **Gate-width trap (load-bearing for this phase).** `npm run test:automated` (via
> `test-gate.mjs`) deliberately excludes nine `MANUAL_ONLY_TESTS` files; CI runs the full
> `npm test` glob. `vice-proxy.test.ts` is in the excluded set and holds *structural* guards
> that regex-scan sibling source files by path. A path relocation is exactly the change class
> those guards fire on, so **no task in this phase may be declared done on `test:automated`
> alone** — success criterion 5 requires the full glob against the moved tree.

---

## Sampling Rate

- **After every task commit:** `npm run typecheck && npm run test:automated` from the
  (possibly relocated) vice-mcp package directory.
- **After every plan wave:** `VICE_REQUIRE_ACME=1 npm test` (full glob, matching CI exactly)
  plus `scripts/package.sh`, `node scripts/check-npm-packages.mjs`,
  `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-fork-honesty.mjs`.
- **Before `/gsd-verify-work`:** full glob green from the moved tree, `scripts/package.sh`
  green, and the PKG-03 planted-violation demonstration performed and recorded as evidence.
- **Max feedback latency:** ~180 seconds (full glob).

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table pins the **requirement → automated command**
contract each task must satisfy. The planner fills the Task ID / Plan / Wave columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01 T1 | 16-01 | 1 | PKG-01 (skills relocation, tracer) | T-16-07, T-16-08 | Corpus walks keep their non-vacuity floors; the sibling-directory scan cannot narrow silently | integration | `node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-fork-honesty.mjs && cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` | ✅ exists — literal-path updates only | ⬜ pending |
| 16-01 T2 | 16-01 | 1 | PKG-01 (payload absent from repo root; installer route) | T-16-04, T-16-09 | Auto-discoverable payload at repo root fails CI; no machine-global plugin state written | integration/script | `bash scripts/package.sh && node scripts/check-npm-packages.mjs` | ✅ exists — `mustNotExist` list added | ⬜ pending |
| 16-01 T3 | 16-01 | 1 | PKG-01 (dev-time story recorded) | — | N/A | doc + corpus check | `node scripts/check-skill-fork-honesty.mjs` | ✅ exists | ⬜ pending |
| 16-02 T1 | 16-02 | 1 | PKG-04 (facts verified against source + live bind) | T-16-10 | Every accepted-risk claim traces to a `file:line` or captured output; no source file edited | manual/documentation + live socket observation | `test -f .../16-PKG04-EVIDENCE.md && git diff --quiet -- src/mcp/vice`; live: `ss -tlnp` for the control port | ❌ W0 (evidence doc) | ⬜ pending |
| 16-02 T2 | 16-02 | 1 | PKG-04 (disposition recorded) | T-16-02, T-16-11 | Exposure explicitly accepted with rationale, residual risk and reversal criteria — never silently `0.0.0.0` and undocumented | documentation (structural assertion) | `node -e` PROJECT.md row shape/content check (see plan 16-02 Task 2) + `npm run test:automated` | ❌ W0 (PROJECT.md row) | ⬜ pending |
| 16-03 T1 | 16-03 | 1 | PKG-01 (`.mcp.json` merge, happy paths) | T-16-12, T-16-14 | Merge preserves unrelated keys and is idempotent; dry-run writes nothing | unit | `cd installer && npm test` | ❌ W0 | ⬜ pending |
| 16-03 T2 | 16-03 | 1 | PKG-01 (`.mcp.json` merge, refusal paths) | T-16-01, T-16-13 | Six malformed consumer-config shapes are refused with bytes and directory listing unchanged | unit | `cd installer && npm test` | ❌ W0 | ⬜ pending |
| 16-04 T1 | 16-04 | 2 | PKG-01 (MCP-server relocation + consumer sweep) | T-16-03, T-16-04, T-16-17 | Published tarball path list unchanged; no auto-discoverable payload at repo root | integration/script | `cd src/mcp/vice && npm run typecheck && VICE_REQUIRE_ACME=1 npm test`; `node scripts/check-npm-packages.mjs`; `npm pack --dry-run --json` 73-entry parity | ✅ exists — literal-path updates only | ⬜ pending |
| 16-04 T2 | 16-04 | 2 | PKG-01 (repo-root depth record) | T-16-15 | Branch-4 hop count asserted correct and provably unedited | unit | `node -e` segment-count assertion + `cd src/mcp/vice && node --test repo-root.test.ts host-scripts.test.ts` | ✅ exists | ⬜ pending |
| 16-04 T3 | 16-04 | 2 | PKG-01 (generated artifact + enumeration closed) | T-16-16, T-16-17 | Generated banner regenerated from its generator; every residual old-path hit deliberately classified | integration | `cd src/mcp/vice && node --test r2000-regbits.test.ts test-gate.test.ts && npm run smoke && VICE_REQUIRE_ACME=1 npm test` | ✅ exists | ⬜ pending |
| 16-06 T1 | 16-06 | 3 | PKG-02 (`derive.mjs`) | T-16-06, T-16-24 | Per-test temp dirs only; discovered by both gates | unit/integration (subprocess) | `cd src/mcp/vice && node --test skill-program-recon-cli.test.ts` | ❌ W0 | ⬜ pending |
| 16-06 T2 | 16-06 | 3 | PKG-02 (`driver.mjs`) | T-16-22, T-16-06 | Network rebuild verb mechanically excluded; committed data file provably unmodified | unit (in-process export + subprocess CLI) | `cd src/mcp/vice && node --test skill-memory-mapping-cli.test.ts && git diff --quiet -- src/skills/c64-memory-mapping/memmap.json` | ❌ W0 | ⬜ pending |
| 16-06 T3 | 16-06 | 3 | PKG-02 (`acme.mjs`) | T-16-23, T-16-25 | Assembler reached through the one shared availability seam; hard-fails in CI rather than skipping | unit/integration (subprocess) | `cd src/mcp/vice && VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts && VICE_REQUIRE_ACME=1 npm test` | ❌ W0 | ⬜ pending |
| 16-07 T1 | 16-07 | 3 | PKG-03 (gate exists, calibrated, fixture-pinned) | T-16-26, T-16-05 | Zero false positives over the measured corpus; cut-set parse asserted non-empty; fixture outside the scanned set | unit (guard test + fixture) | `cd src/mcp/vice && node --test comment-phase-pointers.test.ts` | ❌ W0 | ⬜ pending |
| 16-07 T2 | 16-07 | 3 | PKG-03 (zero orphaned references remain) | T-16-28, T-16-29, T-16-30 | All 15 sites repointed at existing permanent records; no new cut, no exemption, comment-only diffs | unit (corpus assertions) | `cd src/mcp/vice && node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts stock-dispatch.test.ts && VICE_REQUIRE_ACME=1 npm test` | ❌ W0 | ⬜ pending |
| 16-07 T3 | 16-07 | 3 | PKG-03 (gate **bites**) | T-16-27 | Planted violation detected then removed; plant does not survive; narration negative control stays green | fixture-driven + one-time recorded demonstration | plant → `node --test comment-phase-pointers.test.ts` (red, captured) → remove → green (captured); `git status --porcelain -- src` empty | ❌ W0 | ⬜ pending |
| 16-05 T1 | 16-05 | 4 | PKG-01 (guidance-document sweep) | T-16-20 | Every backticked source path exists on disk; skills table mirrors the playbooks | doc (structural assertion) | `node -e` skills-table path-existence check + `cd src/mcp/vice && node --test docs-dangling-refs.test.ts` | ✅ exists | ⬜ pending |
| 16-05 T2 | 16-05 | 4 | PKG-01 (line-reference citations re-verified) | T-16-19 | Every cited line resolves to a real call or function declaration; at least two citations present | unit (guard test) | `cd src/mcp/vice && node --test docs-linerefs.test.ts` | ✅ exists | ⬜ pending |
| 16-05 T3 | 16-05 | 4 | PKG-01 (README + docs sweep, evidence preserved) | T-16-18, T-16-21 | No measured value, verdict or captured transcript altered; backend-honesty claims unchanged | doc + corpus check | `cd src/mcp/vice && node --test docs-linerefs.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts docs-review-disposition.test.ts`; `node scripts/check-skill-fork-honesty.mjs` | ✅ exists | ⬜ pending |
| (all) | 16-04, 16-05, 16-06, 16-07 | 2-4 | (all) relocation did not break the tree | — | N/A | integration | `VICE_REQUIRE_ACME=1 npm test` (full glob, from the new package directory) — baseline 2292 tests / 2248 pass / 0 fail / 39 skipped / 5 todo / 23 suites, measured 2026-08-22 pre-move | ✅ existing (`resources-sync.test.ts`, byte-pinned manifests) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test for `acme.mjs` — must live **inside** the vice-mcp package directory (the
      `node --test '*.test.*'` glob is cwd-only and non-recursive) and reach the skill script
      by relative path. ACME-on-PATH dependency degrades through the existing
      `VICE_REQUIRE_ACME` gate seam (skip locally, hard-fail in CI).
- [ ] Test for `driver.mjs` — same location constraint; exercise `lookup`/`annotate` against
      the committed `memmap.json`. Must **not** invoke the `memmap` verb (network).
- [ ] Test for `derive.mjs` — same location constraint.
- [ ] PKG-03 guard test + its companion planted-violation fixture under `fixtures/`.
      Pattern must be dry-run against the ~137 pre-existing legitimate `Phase N` comment
      mentions in shipped source and produce zero false positives before being locked in.
- [ ] `wireMcp()` regression test in `installer/` — **no test infrastructure exists in that
      package today** (no `test` script in `installer/package.json`). Standing this up is
      itself Wave 0 work if the planner takes PKG-01's merge-semantics assertion on.
      **Planner decision: taken on** — plan 16-03, wave 1. Reasons: the promoted todo's own
      Solution step 4 asks for exactly this test; `16-RESEARCH.md` § Security Domain names a
      malformed consumer config as a tampering path whose only mitigation is `wireMcp()`'s
      refuse-on-invalid branch, and an unasserted mitigation is a claim; and this item was
      already listed here, so declining it would have had to be a recorded deferral.

*No framework install needed — `node:test` is built in.*

## Wave 0 assignment (filled by plan-phase)

| Wave 0 item | Owning plan | Wave | Notes |
|---|---|---|---|
| `skill-acme-build-cli.test.ts` | 16-06 Task 3 | 3 | Lives in the MCP package (discovery is a non-recursive single-directory listing); assembler reached through `r2000-test-gate.ts`'s existing seam, never a second probe |
| `skill-memory-mapping-cli.test.ts` | 16-06 Task 2 | 3 | In-process for the exported `lookup`, subprocess for the CLI; a self-scanning assertion mechanically forbids invoking the network `memmap` verb |
| `skill-program-recon-cli.test.ts` | 16-06 Task 1 | 3 | Fully subprocess-driven (the script dispatches at module scope); every verb specified exhaustively — it has no external dependency |
| `comment-phase-pointers.test.ts` + `fixtures/planted-phase-pointer-fixture.ts.txt` | 16-07 Tasks 1-3 | 3 | Pattern set dry-run against the corpus is its own acceptance criterion. Measured 2026-08-22 pre-move: 58 shipped modules, 7526 comment spans, 123 phase-naming comment lines, 7 assignment-shape hits, 9 cut-phase hits, union 15 distinct sites, **0 false positives** after a past-tense exclusion on the until-phase pattern |
| `wireMcp()` regression test in `installer/` | 16-03 Tasks 1-2 | 1 | Adds `installer/package.json`'s first `test` script; `node:test` only, no dependency added; the test file must not ship (`files[]` is `bin/`, `skills/`, `README.md`) |
| `16-PKG04-EVIDENCE.md` + PROJECT.md decision row | 16-02 Tasks 1-2 | 1 | Not a test file: PKG-04's accepted-risk branch has a documentation deliverable, so its Wave 0 artefact is the evidence document the row's claims trace to |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Control-plane exposure disposition | PKG-04 | On the recommended accepted-risk branch the deliverable is a PROJECT.md record, not code — there is nothing to assert automatically. On the narrow branch the assertion needs a live listening socket. | Accepted-risk branch: confirm PROJECT.md carries a Key-Decisions-shaped entry naming the bind address, the reason it is `0.0.0.0` (container consumers dialing `host.docker.internal` cannot reach a loopback-bound listener), the compensating control (per-boot capability token, `timingSafeEqual`-compared), and the residual risk. Narrow branch: start the broker, run `ss -tlnp` and confirm the control port is bound to `127.0.0.1`, then confirm a container consumer can still acquire. |
| PKG-03 gate bites on a planted violation | PKG-03 | Success criterion 3 requires *demonstrating* the gate fires, which is an act performed once and recorded — distinct from the guard test simply being green. | Plant the violation, run the guard, capture the failing output as phase evidence, remove the plant, re-run green. Record both outputs. The plant must not survive into the final tree. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 items above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] Every wave-close ran the **full** `npm test` glob, not `test:automated`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
