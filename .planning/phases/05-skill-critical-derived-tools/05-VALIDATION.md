---
phase: 5
slug: skill-critical-derived-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-17
updated: 2026-08-17
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `05-RESEARCH.md` § Validation Architecture. The **Per-Task Verification
> Map** below is filled by the planner once the PLAN.md files exist — every task must
> land in it with an `<automated>` command or an explicit Wave 0 dependency.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` (`node --test`) — no separate test framework |
| **Config file** | none — `.claude/mcp/vice/package.json`'s `"test"` / `"test:automated"` scripts are the only config |
| **Quick run command** | `cd .claude/mcp/vice && node --test stock-memory-search.test.ts stock-symbols.test.ts stock-vicii.test.ts stock-cia.test.ts stock-sprites.test.ts` (per-file, fast, no emulator) |
| **Full suite command** | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`, excludes the 4 frozen `MANUAL_ONLY_TESTS`) |
| **Estimated runtime** | ~5s quick / ~60s full |

*Test file names above are the research's proposed layout — the planner may rename, but
must keep this table and the Per-Task Verification Map consistent with the plans.*

---

## Sampling Rate

- **After every task commit:** the quick run command above (all new per-family test
  files — pure unit tests, no emulator, no external process).
- **After every plan wave:** `cd .claude/mcp/vice && npm run test:automated`.
- **Standing per-phase regression gate (BACK-02):** every wave also runs
  `npm run typecheck`, `npm run smoke`, and `node --test fork-manifest-surface.test.ts`
  — the fork surface must stay byte-identical at 62 tools.
- **Shipping-closure gate, every wave that merges to `main` (Phase 3 Rule 2):** each new
  module must be added to `.claude/mcp/vice/package.json`'s `files[]` **in the same commit
  that makes it reachable from `vice-proxy.ts`**. `release-on-merge` auto-publishes on
  every push to `main`; neither `test:automated` nor `smoke` can see a missing `files[]`
  entry because both run against the repo filesystem, not the packed tarball. Run the
  transitive-closure check (`node scripts/check-npm-packages.mjs`) before every wave merge.
- **Before `/gsd-verify-work`:** full suite green, **plus** a real live-VICE pass for at
  least one call per family — memory search against a known pattern; a symbol
  load/lookup round trip; VIC-II/CIA state read against a running program; sprite
  get/inspect against a program with visible sprites. Live-test against
  `/usr/bin/x64sc` (genuine unpatched stock VICE — the fork shadows it on `PATH`), and
  remember **`-default` must precede `-binarymonitor`** or the monitor never binds.
- **Max feedback latency:** ~5 seconds for the quick loop.

---

## Per-Task Verification Map

> **PLANNER: fill this table.** One row per task across all PLAN.md files in this phase.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(to be filled by planner)_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Behavior → Proof

Seeded from `05-RESEARCH.md`. The planner must assign an owning task to every row.

| Req ID | Behavior | Test Type | Automated Command | Owning Task |
|--------|----------|-----------|-------------------|-------------|
| DERIV-01 | `vice_memory_search` finds an exact and a wildcard-masked pattern; respects `max_results` | unit (synthetic byte buffer via a fake `session.client.send`) | `node --test stock-memory-search.test.ts` | _planner_ |
| DERIV-01 | `vice_memory_compare` (`mode:'ranges'`) reports byte-level differences; range2 length derived from range1; `mode:'snapshot'` refused with an explanatory message | unit | `node --test stock-memory-search.test.ts` | _planner_ |
| DERIV-04 | `vice_symbols_load` parses a real ACME `--vicelabels`-shaped fixture; `vice_symbols_lookup` resolves both directions; `vice_disassemble`'s existing `show_symbols` path picks up the installed resolver with **no code change** | unit + one integration assertion against `stock-address.ts`'s live holder | `node --test stock-symbols.test.ts` | _planner_ |
| DERIV-05 | `vice_vicii_get_state` / `vice_cia_get_state` decode every readable bit field correctly against a known byte pattern; every internal-only field is `{available:false, reason}` — **never a bare `0`** | unit, exhaustive per declared field | `node --test stock-vicii.test.ts stock-cia.test.ts` | _planner_ |
| DERIV-05 | `sidefx:false` asserted on the wire body for both chips (read-hazard regression guard) | unit (captured wire body) | `node --test stock-vicii.test.ts stock-cia.test.ts` | _planner_ |
| DERIV-06 | `vice_sprite_get`'s decoded fields match a hand-resolved fixture (cross-check against `dump-artifacts.mjs`'s committed `dd00_raw=193, d018_raw=49 → screen_base=35840` case) | unit | `node --test stock-sprites.test.ts` | _planner_ |
| DERIV-06 | `vice_sprite_inspect`'s ASCII output matches the legend exactly for a synthetic hi-res **and** a synthetic multicolour bitmap | unit | `node --test stock-sprites.test.ts` | _planner_ |
| Success Criterion 5 | Every documented tool call across the six skills for these 8 tools resolves against `tools-manifest.stock.json` with no unadvertised-tool failure | **no mechanical check exists today** — planner decides: build `scripts/check-skill-tool-coverage.mjs` now (shared with Phase 8 `DIST-01`) or record a documented manual pass | TBD by planner | _planner_ |

---

## Wave 0 Requirements

Per the research, nothing in this phase's implementation surface exists yet. Each plan
should create its own test file in the same plan as the code it covers (Phase 4's
established pattern — no separate Wave 0 scaffold pass), so that no `<automated>` command
references a test file its own plan or an earlier wave does not create.

- [ ] `stock-memory-search.ts` + `stock-memory-search.test.ts` — nothing exists yet
- [ ] `stock-symbols.ts` + `stock-symbols.test.ts` — nothing exists yet; the extension
      point it installs into (`stock-address.ts`'s `SymbolResolver`, widened in Phase 4
      for exactly this use) already exists and needs no change
- [ ] `stock-vicii.ts` + `stock-vicii.test.ts`, `stock-cia.ts` + `stock-cia.test.ts` — nothing exists yet
- [ ] `stock-sprites.ts` + `stock-sprites.test.ts` — nothing exists yet; the pointer-chain
      arithmetic to port exists (`c64-ram-capture/scripts/dump-artifacts.mjs`, JavaScript,
      fixture-verified) but has never been imported into `.claude/mcp/vice/`
- [ ] `tools-manifest.stock.json` — 8 new entries (26 → 34 tools); fork manifest must stay
      byte-identical
- [ ] `docs/stock-vice-parity.md` — record this phase's three trims (`mode:'snapshot'`
      refused, `format:'kickasm'/'simple'` refused, `format:'png_base64'` omitted) and the
      DERIV-05 stock **gain** (`sidefx:false` chip-state reads are provably side-effect-free,
      unlike the fork's unverified read path)
- [ ] A skill-vs-manifest coverage script, **if** the planner takes research option (a) for
      Success Criterion 5 — otherwise a documented manual pass

*No framework install required — `node:test` is already the project's runner. No new npm
dependency and no new CI step are expected in this phase.*

---

## Manual-Only Verifications

`workflow.human_verify_mode` behaviour follows the project default — these rows are
verified once at the phase boundary rather than as in-plan checkpoints.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One live call per tool family against a running stock VICE | DERIV-01, DERIV-04, DERIV-05, DERIV-06 | Requires a running emulator; the existing 4 frozen `MANUAL_ONLY_TESTS` establish this boundary | Launch `/usr/bin/x64sc -default -binarymonitor` (flag order is load-bearing), then: search for a known byte pattern in a loaded program; load an ACME-produced `.lbl` and look up a symbol both directions; read VIC-II and CIA state while a program runs and confirm unavailable fields report `available:false`; get + inspect a sprite from a program with visible sprites |
| Fork surface unchanged end-to-end | BACK-02 (standing) | Needs the fork build, which CI does not have | Against the custom `x64sc -mcpserver` build, confirm `tools/list` still returns the unchanged v0.1.x set of 62 tools |

*Everything else in this phase has automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for the quick loop
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
