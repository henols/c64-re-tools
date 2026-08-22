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
| TBD | TBD | TBD | PKG-01 (tarball contents after move) | — | Published tarball omits no required module and leaks no test/fixture/`node_modules` | integration/script | `node scripts/check-npm-packages.mjs` | ✅ exists — needs literal-path updates, not a new file | ⬜ pending |
| TBD | TBD | TBD | PKG-01 (`.mcp.json` merge) | T-16-01 | Merge preserves unrelated keys; refuses (does not overwrite) invalid JSON or a non-object root | unit | new test in `installer/` — see Wave 0 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PKG-02 (`acme.mjs`) | — | N/A | unit/integration (subprocess) | `node --test <acme-cli test>` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PKG-02 (`driver.mjs`) | — | N/A | unit (subprocess, `lookup`/`annotate` against committed `memmap.json` — never `memmap`, which needs network) | `node --test <driver-cli test>` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PKG-02 (`derive.mjs`) | — | N/A | unit/integration (subprocess) | `node --test <derive-cli test>` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PKG-03 (gate exists and is green) | — | N/A | unit (guard test) | `node --test <comment-pointer guard test>` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PKG-03 (gate **bites**) | — | N/A | fixture-driven negative test | planted-violation fixture under `fixtures/`, asserted to fail the guard; plant must not survive the commit | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PKG-04 | T-16-02 | Broker control-plane exposure is either loopback-bound or explicitly accepted with rationale — never silently `0.0.0.0` and undocumented | manual/documentation on the accepted-risk branch; live bind check on the narrow branch | N/A (doc edit) **or** `ss -tlnp \| grep <control port>` | N/A | ⬜ pending |
| TBD | TBD | TBD | (all) relocation did not break the tree | — | N/A | integration | `VICE_REQUIRE_ACME=1 npm test` (full glob, from the new package directory) | ✅ existing (`resources-sync.test.ts`, byte-pinned manifests) | ⬜ pending |

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

*No framework install needed — `node:test` is built in.*

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
