---
phase: 5
slug: skill-critical-derived-tools
status: planned
nyquist_compliant: true
wave_0_complete: false
gap_closure_waves: [5, 6, 7, 8]
created: 2026-08-17
updated: 2026-08-17
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `05-RESEARCH.md` § Validation Architecture. The **Per-Task Verification
> Map** below was filled by the planner once the eight PLAN.md files existed — every task
> lands in it with an `<automated>` command, and no command references a test file its own
> plan (or an earlier wave's plan) does not create.
>
> **This document covers two planning passes.** Everything down to "Validation Sign-Off"
> describes the original eight plans (waves 1-4, shipped). The **Gap-Closure Addendum** at the
> end covers plans 05-09..05-13 (waves 5-8), planned 2026-08-17 after `05-VERIFICATION.md`
> returned `gaps_found` on criteria 3 and 4. Read both halves: the tables above are not the
> phase's whole sampling map any more.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` (`node --test`) — no separate test framework |
| **Config file** | none — `.claude/mcp/vice/package.json`'s `"test"` / `"test:automated"` scripts are the only config |
| **Quick run command** | `cd .claude/mcp/vice && node --test stock-memory-search.test.ts stock-symbols.test.ts stock-vicii.test.ts stock-cia.test.ts stock-sprites.test.ts` (per-file, fast, no emulator) |
| **Full suite command** | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`, excludes the 4 frozen `MANUAL_ONLY_TESTS`) |
| **Criterion-5 command** | `node scripts/check-skill-tool-coverage.mjs` (repo root; created by 05-08) |
| **Estimated runtime** | ~5s quick / ~60s full / <1s criterion 5 |

*The research's proposed test-file layout was kept verbatim: five new `*.test.ts` files, one
per production module, colocated. Two existing test files are extended
(`stock-handler.test.ts` by 05-02, `stock-dispatch.test.ts` and `hostpath-consumers.test.ts`
by 05-06 and 05-07).*

---

## Sampling Rate

- **After every task commit:** the quick run command above (pure unit tests, no emulator, no
  external process) plus `npm run typecheck`.
- **After every plan wave:** `cd .claude/mcp/vice && npm run test:automated`.
- **Standing per-phase regression gate (BACK-02):** every wave also runs
  `npm run typecheck`, `npm run smoke`, `node --test fork-manifest-surface.test.ts` (the
  fork surface must stay byte-identical at 62 tools) and
  `node --test hostpath-consumers.test.ts` (`EXPECTED_IMPORTERS` must stay exactly five).
- **Shipping-closure gate, every wave that merges to `main` (Phase 3 Rule 2):** run
  `node scripts/check-npm-packages.mjs` **before** the merge. `release-on-merge`
  auto-publishes on every push to `main` unless the commit **subject** carries
  `[skip release]`, and neither `test:automated` nor `smoke` can see a missing `files[]`
  entry because both run against the repo filesystem, not the packed tarball. See the wave
  table below for which plan writes `package.json` and which must not.
- **From wave 4 onward:** `node scripts/check-skill-tool-coverage.mjs` — criterion 5's gate,
  also wired into CI's `build` job by 05-08 T2.
- **Before `/gsd-verify-work`:** full suite green, **plus** a real live-VICE pass for at
  least one call per family — memory search against a known pattern; a symbol load/lookup
  round trip; VIC-II/CIA state read against a running program (confirming unavailable fields
  report `available: false`); sprite get/inspect against a program with visible sprites.
  Live-test against `/usr/bin/x64sc` (genuine unpatched stock VICE — the fork shadows it on
  `PATH`), and remember **`-default` must precede `-binarymonitor`** or the monitor never
  binds.
- **Max feedback latency:** ~5 seconds for the quick loop.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01 T1 | 05-01 | 1 | DERIV-01 | T-05-01-01, T-05-01-02, T-05-01-04, T-05-01-05 | Addresses through the one parser; `pattern`/`mask` per-element validated and bounded by both the range length and 4096; `sidefx:false` hardcoded; no resume | source assertion + typecheck | `cd .claude/mcp/vice && npm run typecheck` + the forbidden/required-token node check | ❌ new | ⬜ pending |
| 05-01 T2 | 05-01 | 1 | DERIV-01 | T-05-01-01, T-05-01-06, T-05-01-07 | `range2_end` derived from range 1 and clamped at `$ffff`; `mode:'snapshot'` refused before any send; `identical` cannot be true when truncated | source assertion + typecheck | `cd .claude/mcp/vice && npm run typecheck` + the `memGetBody`-call-site and refusal-text node check | ✅ extend (T1's file) | ⬜ pending |
| 05-01 T3 | 05-01 | 1 | DERIV-01 | T-05-01-02, T-05-01-03, T-05-01-04, T-05-01-06 | Zero sends on every argument refusal (≥12 cases); `sidefx` byte asserted `0x00` on every call; `max_results` truncation flagged | unit, fake session | `cd .claude/mcp/vice && node --test stock-memory-search.test.ts test-gate.test.ts` | ❌ new | ⬜ pending |
| 05-02 T1 | 05-02 | 1 | DERIV-04 | T-05-02-07 | A session-free answer carries `runState: "unknown"` through one shared builder; a caller-supplied `runState` is overwritten | unit | `cd .claude/mcp/vice && node --test stock-handler.test.ts` + the `derivedAnswer` behaviour node check | ✅ extend | ⬜ pending |
| 05-02 T2 | 05-02 | 1 | DERIV-04 | T-05-02-01, T-05-02-02, T-05-02-03, T-05-02-04 | `path` resolved against `repoRoot()` and re-checked through `realpathSync`; three resource ceilings; no `hostpath.ts`/`stock-paths.ts` import; one resolver holder | source assertion + structural unit | `cd .claude/mcp/vice && npm run typecheck && node --test hostpath-consumers.test.ts` + the forbidden-import node check | ❌ new | ⬜ pending |
| 05-02 T3 | 05-02 | 1 | DERIV-04 | T-05-02-01, T-05-02-02, T-05-02-03, T-05-02-05, T-05-02-06 | `..` and symlink escapes refused; all three ceilings refused; load replaces rather than merges; `parseAddress`/`symbolNameFor`/`hasSymbolStore` change behaviour with no other module edited | unit + live-holder integration | `cd .claude/mcp/vice && node --test stock-symbols.test.ts stock-address.test.ts stock-disassemble.test.ts test-gate.test.ts` | ❌ new | ⬜ pending |
| 05-03 T1 | 05-03 | 1 | DERIV-05 | T-05-03-01, T-05-03-02, T-05-03-03, T-05-03-04, T-05-03-06 | Exactly one `memGetBody` site with `sidefx:false`; six unavailable fields rendered from one registry as `{available:false, reason}`; any argument refused; 47-byte length enforced | source assertion + pure-function check | `cd .claude/mcp/vice && npm run typecheck` + the registry/decode node check | ❌ new | ⬜ pending |
| 05-03 T2 | 05-03 | 1 | DERIV-05 | T-05-03-01, T-05-03-02, T-05-03-03, T-05-03-07 | `rasterLine` reconstructed across two registers; every unavailable field proven not `0` and not absent; `sidefx` byte and both address fields asserted on the wire; short read refused | unit, exhaustive per field | `cd .claude/mcp/vice && node --test stock-vicii.test.ts test-gate.test.ts` | ❌ new | ⬜ pending |
| 05-04 T1 | 05-04 | 1 | DERIV-05 | T-05-04-01, T-05-04-03, T-05-04-05, T-05-04-06, T-05-04-08 | `sidefx:false` on every chip read; five write-side/internal fields from one registry; `cia` validated against the literals 1 and 2; 16-byte length enforced | source assertion + pure-function check | `cd .claude/mcp/vice && npm run typecheck` + the registry/`vicBank`/decode node check | ❌ new | ⬜ pending |
| 05-04 T2 | 05-04 | 1 | DERIV-05 | T-05-04-01, T-05-04-02, T-05-04-03, T-05-04-04, T-05-04-05 | Active-low polarity pinned; BCD TOD pinned; the three read-vs-write pairings asserted as distinct fields; `sidefx` asserted on EVERY call; per-chip ranges asserted | unit, per chip | `cd .claude/mcp/vice && node --test stock-cia.test.ts test-gate.test.ts` | ❌ new | ⬜ pending |
| 05-05 T1 | 05-05 | 1 | DERIV-06 | T-05-05-01, T-05-05-02, T-05-05-03, T-05-05-07, T-05-05-08 | Geometry ported verbatim and re-verified against the committed `dd00=193/d018=0x31 → 35840` fixture; derived addresses bounds-checked before sending; index validated `0..7` not via `parseByteCount` | source assertion + pure-function check | `cd .claude/mcp/vice && npm run typecheck` + the geometry-fixture node check | ❌ new | ⬜ pending |
| 05-05 T2 | 05-05 | 1 | DERIV-06 | T-05-05-02, T-05-05-05, T-05-05-09 | Native-resolution grids (24 hi-res / 12 multicolour); the fork's non-numeric legend mapping; `png_base64` refused before any send; both handlers share one read helper | source assertion + pure-function check | `cd .claude/mcp/vice && npm run typecheck` + the renderer node check (`@#%` row-0 assertion) | ✅ extend (T1's file) | ⬜ pending |
| 05-05 T3 | 05-05 | 1 | DERIV-06 | T-05-05-01, T-05-05-02, T-05-05-04, T-05-05-05, T-05-05-06, T-05-05-09 | Committed fixture reproduced end to end; per-sprite multicolour asserted in both directions; read order and `sidefx` asserted per call; `sprite: 0` accepted; ROM-window note emitted | unit, address-dispatching stub | `cd .claude/mcp/vice && node --test stock-sprites.test.ts test-gate.test.ts` | ❌ new | ⬜ pending |
| 05-06 T1 | 05-06 | 2 | DERIV-01, DERIV-04 | **T-05-06-01**, T-05-06-02 | Both newly-reachable modules join `files[]` in the SAME commit as the import; transitive closure from `vice-proxy.ts` walked; no fall-through; exactly two `needsSession:false` registrations | packaging closure + source assertion + smoke | `cd .claude/mcp/vice && npm run typecheck && npm run smoke` + the closure/`files[]`=41 node check | ✅ extend | ⬜ pending |
| 05-06 T2 | 05-06 | 2 | DERIV-01, DERIV-04 | T-05-06-03, T-05-06-07 | Fork-compatible `inputSchema` (equal required sets, every fork property present with matching type, `snapshot_name` retained); `outputSchema` within the supported keyword subset with a required `runState` | manifest gates | `cd .claude/mcp/vice && node --test stock-dispatch.test.ts fork-manifest-surface.test.ts` + the 30-tool manifest node check | ✅ extend | ⬜ pending |
| 05-06 T3 | 05-06 | 2 | DERIV-01, DERIV-04 | T-05-06-04, T-05-06-05, T-05-06-06 | Four conformance cases through the REAL `dispatchStock`; symbol tools proven session-free by `THROWING_ENSURE_LEASE`; `resolvedPath` proven container-side under a translating env; the derived-module guard made non-vacuous | unit (conformance harness) + structural | `cd .claude/mcp/vice && node --test stock-dispatch.test.ts hostpath-consumers.test.ts && npm run test:automated` | ✅ extend | ⬜ pending |
| 05-07 T1 | 05-07 | 3 | DERIV-05, DERIV-06 | **T-05-07-01**, T-05-07-03 | All three remaining modules join `files[]` in the SAME commit as the imports; closure walked; `check-npm-packages.mjs`'s regression list made phase-neutral over all ten derived modules | packaging closure + smoke | `cd .claude/mcp/vice && npm run typecheck && npm run smoke` + the closure/`files[]`=44/regression-list node check | ✅ extend | ⬜ pending |
| 05-07 T2 | 05-07 | 3 | DERIV-05, DERIV-06 | **T-05-07-02**, T-05-07-04, T-05-07-07 | Eleven unavailable fields pinned with `available: enum [false]` and `required: ["available","reason"]`; `format` enum narrowed while keeping `type: "string"`; fork manifest untouched | manifest gates (schema pin) | `cd .claude/mcp/vice && node --test stock-dispatch.test.ts fork-manifest-surface.test.ts` + the 34-tool/pin-shape node check | ✅ extend | ⬜ pending |
| 05-07 T3 | 05-07 | 3 | DERIV-05, DERIV-06 | T-05-07-02, T-05-07-05, T-05-07-06 | Four conformance cases with a send stub that THROWS on an unmapped start address; the schema pin and the real answer asserted to agree through the real dispatch path; nine-entry derived-module map with on-disk existence | unit (conformance harness) + structural | `cd .claude/mcp/vice && node --test stock-dispatch.test.ts hostpath-consumers.test.ts && npm run test:automated` | ✅ extend | ⬜ pending |
| 05-08 T1 | 05-08 | 4 | DERIV-01, DERIV-04, DERIV-05, DERIV-06 | **T-05-08-01**, T-05-08-02, T-05-08-03, T-05-08-04 | Criterion 5 mechanised; five classified allowlist sets each with a reason and a route; three non-vacuity controls; a planted unclassified name proven to fail the check; skill content never executed | CLI gate + live non-vacuity probe | `node scripts/check-skill-tool-coverage.mjs` + the planted-`vice_totally_made_up` probe | ❌ new | ⬜ pending |
| 05-08 T2 | 05-08 | 4 | DERIV-01, DERIV-04, DERIV-05, DERIV-06 | T-05-08-07 | The criterion-5 gate is blocking, positioned beside the packaging gate, with no `continue-on-error` and no other job touched | workflow assertion | the CI step-placement node check + `node scripts/check-skill-tool-coverage.mjs` | ✅ extend | ⬜ pending |
| 05-08 T3 | 05-08 | 4 | DERIV-05 | T-05-08-05, **T-05-08-06** | All eleven unavailable field names, the four trim decision ids, the DERIV-05 side-effect-free gain, the `R2000-16` assumption, and the corrected exception count recorded; three stale phase pointers fixed | doc assertion | the `docs/stock-vice-parity.md` token/anti-token node check | ✅ extend | ⬜ pending |
| 05-08 T4 | 05-08 | 4 | DERIV-05, DERIV-06 | T-05-08-05, T-05-08-06 | Every grouped tool recommendation now says which members work on stock; `vice_keyboard_restore`'s fork requirement named at its point of use; `installer/skills/` uncommitted | doc assertion + CLI gate | the five-file token check + `node scripts/check-skill-tool-coverage.mjs` + the `installer/skills` cleanliness check | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Behavior → Proof

| Req ID | Behavior | Test Type | Automated Command | Owning Task |
|--------|----------|-----------|-------------------|-------------|
| DERIV-01 | `vice_memory_search` finds an exact and a wildcard-masked pattern; respects `max_results` | unit (synthetic byte buffer via a fake `session.client.send`) | `node --test stock-memory-search.test.ts` | 05-01 T3 (built by 05-01 T1) |
| DERIV-01 | `vice_memory_compare` (`mode:'ranges'`) reports byte-level differences; range2 length derived from range1; `mode:'snapshot'` refused with an explanatory message and zero sends | unit | `node --test stock-memory-search.test.ts` | 05-01 T3 (built by 05-01 T2) |
| DERIV-01 | Both tools are advertised, dispatched from the one table, and their real answers conform to their own `outputSchema` | unit (conformance harness) | `node --test stock-dispatch.test.ts` | 05-06 T2, 05-06 T3 |
| DERIV-04 | `vice_symbols_load` parses a real ACME `--vicelabels`-shaped fixture; `vice_symbols_lookup` resolves both directions; `vice_disassemble`'s existing `show_symbols` path picks up the installed resolver with **no code change** | unit + one integration assertion against `stock-address.ts`'s live holder | `node --test stock-symbols.test.ts stock-address.test.ts stock-disassemble.test.ts` | 05-02 T3 |
| DERIV-04 | A `path` outside the workspace root — including via a symlink — is refused, and three resource ceilings refuse with the observed value and the limit named | unit | `node --test stock-symbols.test.ts` | 05-02 T3 (controls built by 05-02 T2) |
| DERIV-04 | Loading a symbol table opens no monitor session at all | unit, unreachable-stub proof | `node --test stock-dispatch.test.ts` | 05-06 T3 |
| DERIV-05 | `vice_vicii_get_state` / `vice_cia_get_state` decode every readable bit field correctly against a known byte pattern; every internal-only field is `{available:false, reason}` — **never a bare `0`** | unit, exhaustive per declared field | `node --test stock-vicii.test.ts stock-cia.test.ts` | 05-03 T2, 05-04 T2 |
| DERIV-05 | The same never-zero promise is enforced from the **manifest** side, so a regression fails a gate not derived from the decoder | unit (conformance harness against the `enum: [false]` pin) | `node --test stock-dispatch.test.ts` | 05-07 T2, 05-07 T3 |
| DERIV-05 | `sidefx:false` asserted on the wire body for both chips (read-hazard regression guard) | unit (captured wire body) | `node --test stock-vicii.test.ts stock-cia.test.ts` | 05-03 T2, 05-04 T2 |
| DERIV-06 | `vice_sprite_get`'s decoded fields match a hand-resolved fixture (cross-checked against `dump-artifacts.mjs`'s committed `dd00_raw=193, d018_raw=49 → screen_base=35840` case) | unit | `node --test stock-sprites.test.ts` | 05-05 T3 (geometry built by 05-05 T1) |
| DERIV-06 | `vice_sprite_inspect`'s ASCII output matches the legend exactly for a synthetic hi-res **and** a synthetic multicolour bitmap, at native resolution per mode | unit | `node --test stock-sprites.test.ts` | 05-05 T3 (renderers built by 05-05 T2) |
| Success Criterion 5 | Every `vice_*` name the six skills reference resolves against `tools-manifest.stock.json`, or is classified in a committed allowlist with a reason and a route; the check is non-vacuous and the allowlist shrinks by failing | CLI gate (repo-root script) + CI step | `node scripts/check-skill-tool-coverage.mjs` | 05-08 T1, 05-08 T2 |
| Phase 3 Rule 2 (shipping closure) | Every module reachable from `vice-proxy.ts` is in `package.json`'s `files[]`, added in the commit that made it reachable | packaging gate | `node scripts/check-npm-packages.mjs` | 05-06 T1, 05-07 T1 |
| BACK-02 (standing) | The fork manifest stays byte-identical at 62 tools and `hostpath.ts`'s consumer set stays exactly five | unit, structural | `node --test fork-manifest-surface.test.ts hostpath-consumers.test.ts` | every plan's verification block |

---

## Shipping Correctness: how `package.json` writes are distributed

Phase 3's Rule 2 binds a module to `files[]` at the commit that makes it **reachable from
the shipped entry point** (`vice-proxy.ts`), not at the end of the phase. Reachability by
wave, and therefore who writes `package.json`:

| Wave | Plan | New module(s) created | Reachable from `vice-proxy.ts` yet? | Writes `package.json`? |
|------|------|------------------------|--------------------------------------|-------------------------|
| 1 | 05-01 | `stock-memory-search.ts` | no — nothing imports it | **no** |
| 1 | 05-02 | `stock-symbols.ts` (+ an export added to the already-shipped `stock-handler.ts`) | `stock-symbols.ts` no; `stock-handler.ts` already listed | **no** |
| 1 | 05-03 | `stock-vicii.ts` | no — nothing imports it | **no** |
| 1 | 05-04 | `stock-cia.ts` | no — nothing imports it | **no** |
| 1 | 05-05 | `stock-sprites.ts` | no — nothing imports it | **no** |
| 2 | 05-06 | (registration only) | **yes** — `stock-dispatch.ts` imports `stock-memory-search.ts` and `stock-symbols.ts` | **yes** (+2 → 41) |
| 3 | 05-07 | (registration only) | **yes** — `stock-dispatch.ts` imports `stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts` | **yes** (+3 → 44) |
| 4 | 05-08 | `scripts/check-skill-tool-coverage.mjs` | n/a — a repo-root script, not part of the `@henols/vice-mcp` package | **no** |

`files[]` entry count: **39** at phase start → **41** after 05-06 → **44** after 05-07.

**No same-wave write conflict.** `package.json` is written in waves 2 and 3 only, and each
of those waves has exactly one plan. Wave 1 is the multi-plan wave, and **none** of its five
plans writes `package.json` — truthfully, because none of the five new modules is reachable
from any shipped module until 05-06/05-07 wire the tools.

All five wave-1 plans and 05-08 carry an explicit written instruction **not** to touch
`package.json`, with the reachability reason, so an executor does not "helpfully" add an
entry and create a conflict with a later plan's edit. 05-08's instruction additionally
explains why the coverage script and the skill edits need no `files[]` change at all
(`installer/skills/` is gitignored and regenerated on `prepack`).

### Other shared files, by wave

| File | Wave 1 | Wave 2 | Wave 3 | Wave 4 |
|------|--------|--------|--------|--------|
| `stock-derived.ts` | — | **05-06** | **05-07** | — |
| `stock-dispatch.ts` | — | **05-06** | **05-07** | — |
| `tools-manifest.stock.json` | — | **05-06** | **05-07** | — |
| `stock-dispatch.test.ts` | — | **05-06** | **05-07** | — |
| `hostpath-consumers.test.ts` | — | **05-06** | **05-07** | — |
| `package.json` | — | **05-06** | **05-07** | — |
| `stock-handler.ts` / `.test.ts` | **05-02** only | — | — | — |
| `scripts/check-npm-packages.mjs` | — | — | **05-07** | — |
| `.github/workflows/ci.yml` | — | — | — | **05-08** |
| `docs/stock-vice-parity.md` | — | — | — | **05-08** |
| `.claude/skills/**` | — | — | — | **05-08** |

Every shared file has exactly one owner per wave, and waves 2 and 3 are single-plan, so no
two concurrently-running plans ever write the same file.

---

## Wave 0 Requirements

Every file below is created by the plan named beside it. There is no separate Wave 0 scaffold
pass, because each plan creates its own test file in the same plan as the code it covers
(Phase 4's established pattern). No `<automated>` command in any task references a test file
that its own plan, or an earlier wave's plan, does not create.

- [ ] `stock-memory-search.ts` + `stock-memory-search.test.ts` — **05-01** (wave 1)
- [ ] `stock-symbols.ts` + `stock-symbols.test.ts`, plus `derivedAnswer()` in the existing
      `stock-handler.ts`/`stock-handler.test.ts` — **05-02** (wave 1). The extension point it
      installs into (`stock-address.ts`'s `SymbolResolver`, widened in Phase 4 for exactly
      this use) already exists and needs no change
- [ ] `stock-vicii.ts` + `stock-vicii.test.ts` — **05-03** (wave 1)
- [ ] `stock-cia.ts` + `stock-cia.test.ts` — **05-04** (wave 1)
- [ ] `stock-sprites.ts` + `stock-sprites.test.ts` — **05-05** (wave 1). The pointer-chain
      arithmetic to port exists (`c64-ram-capture/scripts/dump-artifacts.mjs`, JavaScript,
      fixture-verified) but has never been imported into `.claude/mcp/vice/`; it is **copied**
      into TypeScript, never imported at runtime
- [ ] `tools-manifest.stock.json` — 4 entries by **05-06** (26 → 30, wave 2) and 4 by
      **05-07** (30 → 34, wave 3); the fork manifest stays byte-identical at 62
- [ ] `scripts/check-skill-tool-coverage.mjs` + its CI step — **05-08** (wave 4); criterion 5's
      gate, taken from research option (a) per D-05-05
- [ ] `docs/stock-vice-parity.md` — this phase's four trim decisions, the eleven unavailable
      fields, the DERIV-05 stock **gain** (`sidefx:false` chip-state reads are provably
      side-effect-free, unlike the fork's unverified read path), the corrected exception
      count, and three stale phase pointers — **05-08** (wave 4)

*No framework install required — `node:test` is already the project's runner. No new npm
dependency and no new CI tool are introduced by this phase; 05-08's CI step runs a committed
zero-dependency script. **No `.mts` file is touched by any plan**, so `build.ts` runs no
recompile and `resources-sync.test.ts` cannot drift — each wave-1 plan states this
explicitly and asserts `git status --porcelain .claude/mcp/vice/resources` is empty.*

**No new test file joins `MANUAL_ONLY_TESTS`** (04-CONTEXT's D-08 explicitly rejects that
route). Every wave-1 plan asserts its own file's absence from `test-gate.mjs` and runs
`node --test test-gate.test.ts`, whose drift guard confirms each new file joined the
automated set.

---

## Manual-Only Verifications

`workflow.human_verify_mode` follows the project default — these rows are verified once at the
phase boundary rather than as in-plan checkpoints.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One live call per tool family against a running stock VICE | DERIV-01, DERIV-04, DERIV-05, DERIV-06 | Requires a running emulator; the existing 4 frozen `MANUAL_ONLY_TESTS` establish this boundary | Launch `/usr/bin/x64sc -default -binarymonitor` (flag order is load-bearing), then: search for a known byte pattern in a loaded program and compare two live ranges; load an ACME-produced `.lbl` and look up a symbol in both directions, then confirm `vice_disassemble` with `show_symbols` renders the names; read VIC-II and CIA state while a program runs and confirm the eleven unavailable fields report `available: false` with a reason; get + inspect a sprite from a program with visible sprites and eyeball the ASCII grid against the screen |
| Fork surface unchanged end-to-end | BACK-02 (standing) | Needs the fork build, which CI does not have | Against the custom `x64sc -mcpserver` build, confirm `tools/list` still returns the unchanged v0.1.x set of 62 tools |
| The published tarball actually boots | Phase 3 Rule 2 | Only observable against a packed tarball, which CI's filesystem-based tests cannot see | After the wave-3 merge, `npm pack` in `.claude/mcp/vice`, extract the tarball to a scratch directory, and run `node vice-proxy.ts` there far enough to confirm no `ERR_MODULE_NOT_FOUND` at module load. `node scripts/check-npm-packages.mjs` is the automated proxy for this and runs per wave |
| CI's criterion-5 step actually *ran* | Phase 5 criterion 5 | Only observable on the PR's Actions log | On the PR, open the `build` job and confirm the `Validate skill tool coverage` step succeeded rather than being skipped |

*Everything else in this phase has automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 23 tasks carry one
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (each plan creates the test file its own commands invoke)
- [x] No watch-mode flags
- [x] Feedback latency < 10s for the quick loop (~5s measured shape, matching Phase 4's)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Every phase success criterion has a named owner: criterion 1 → 05-01 + 05-06; criterion 2 → 05-02 + 05-06; criterion 3 → 05-03 + 05-04 + 05-07 (two independent mechanisms); criterion 4 → 05-05 + 05-07; criterion 5 → 05-08 (mechanised per D-05-05)
- [x] Every requirement id (DERIV-01, DERIV-04, DERIV-05, DERIV-06) appears in at least one plan's `requirements` field

**Approval:** planner-approved 2026-08-17


---

## Gap-Closure Addendum (plans 05-09..05-13, waves 5-8)

Added 2026-08-17 alongside the gap-closure plans, after `05-VERIFICATION.md` returned
`gaps_found` (2/5 must-haves): criteria 3 and 4 failed on CR-01/CR-02 — all four chip/sprite
reads hardcoded `bank: 0x0000`, the banking-dependent CPU view. Same table shapes as above so
this file stays the phase's single sampling source of truth.

### Test Infrastructure delta

| Property | Value |
|----------|-------|
| **Quick run command (waves 5-8)** | `cd .claude/mcp/vice && node --test stock-memory.test.ts stock-vicii.test.ts stock-cia.test.ts stock-sprites.test.ts stock-symbols.test.ts` |
| **Live regression command (opt-in, manual-only)** | `cd .claude/mcp/vice && VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` — genuine unpatched stock VICE; the fork shadows `x64sc` on `PATH`, and `-default` must precede `-binarymonitor` |
| **Default-skip control** | `cd .claude/mcp/vice && node --test stock-live.test.ts` with no env var must report every case SKIPPED and 0 failures |
| **New test files** | **none** — every gap-closure command targets a test file that already exists on `main`, so waves 5-8 have **no Wave 0 requirement** (`wave_0_complete` in the frontmatter refers to waves 1-4 and does not gate these waves) |
| **Automated-suite effect** | `npm run test:automated`'s *pass* count rises with each plan; **0 fail** is the invariant. `stock-live.test.ts` stays in `test-gate.mjs`'s frozen `MANUAL_ONLY_TESTS`, so the live cases never enter the automated run |

### Per-Task Verification Map — waves 5-8

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-09 T1 | 05-09 | 5 | DERIV-05 | T-05-09-02, T-05-09-03 | `resolveRequiredBank()` is the one name-to-wire-id seam: mandatory name, refusal (never a `0x0000` fallback) when the catalog lacks it, at most one `BANKS_AVAILABLE` per session | unit, fake session | `cd .claude/mcp/vice && npm run typecheck && node --test stock-memory.test.ts` + the single-export node check | ✅ extend | ⬜ pending |
| 05-09 T2 | 05-09 | 5 | DERIV-05 | **T-05-09-01**, T-05-09-02, T-05-09-05 | VIC-II/CIA read through the resolved `io` id; no literal bank id in either module; `bank:{id,name:"io"}` on the answer pinned with `enum:["io"]`; zero MEM_GET on refusal | unit (wire-body bank assertion) + manifest gate | `cd .claude/mcp/vice && npm run typecheck && npm run test:automated` + the `readUInt16LE(6)`/no-literal-bank/manifest-pin node check + `node scripts/check-skill-tool-coverage.mjs` | ✅ extend | ⬜ pending |
| 05-09 T3 | 05-09 | 5 | DERIV-05 | **T-05-09-01**, T-05-09-04 | Live at `$01 = $34`: `borderColour 14`, `backgroundColour 6`, CIA1 `portBDirection.raw 0`; an independent CPU-view-vs-`bank:"io"` control proves the banking write took effect; `$01` restored in a `finally` | **live, real stock VICE** (opt-in) + default-skip control | `cd .claude/mcp/vice && node --test stock-live.test.ts && VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts && npm run test:automated` | ✅ extend | ⬜ pending |
| 05-10 T1 | 05-10 | 6 | DERIV-06 | **T-05-10-01**, T-05-10-02, T-05-10-04 | Registers via `io`, pointer table and sprite data via `ram`; `registerBank`/`dataBank` reported and `enum`-pinned; bank-3 `$D000-$DFFF` I/O-window note; char-ROM note unchanged; zero MEM_GET on refusal | unit (per-read wire-body bank) + manifest gate | `cd .claude/mcp/vice && npm run typecheck && npm run test:automated` + the no-literal-bank/two-call-site/rename/manifest-pin node check | ✅ extend | ⬜ pending |
| 05-10 T2 | 05-10 | 6 | DERIV-06 | T-05-10-03 | Two legend constants selected on the per-sprite `multicolour` flag; the hi-res legend names no `@`/`%`; every character the render actually emits appears in its legend; `format:"binary"` carries none | unit (render-vs-legend cross-check) | `cd .claude/mcp/vice && npm run typecheck && npm run test:automated` + the legend-constant node check | ✅ extend | ⬜ pending |
| 05-10 T3 | 05-10 | 6 | DERIV-06 | **T-05-10-01**, T-05-10-03, T-05-10-05 | Live: `vicBank 0` / `screenBase 1024` / `pointerTableAddress 2040` identical with `$01 = $37` and `$01 = $34`, with the `$dd00` CPU-view-vs-`io` control; live hi-res legend carries no `@`/`%` | **live, real stock VICE** (opt-in) + default-skip control | `cd .claude/mcp/vice && node --test stock-live.test.ts && VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts && npm run test:automated` | ✅ extend | ⬜ pending |
| 05-11 T1 | 05-11 | 6 | DERIV-04 | T-05-11-03 | `query.address` echoes the parsed number for every accepted form; the answer validated against the **shipped** `outputSchema`, with a control proving the validator is not vacuous | unit + schema conformance (in-file) | `cd .claude/mcp/vice && npm run typecheck && node --test stock-symbols.test.ts stock-dispatch.test.ts` + the raw-echo-absent node check | ✅ extend | ⬜ pending |
| 05-11 T2 | 05-11 | 6 | DERIV-04 | **T-05-11-01**, T-05-11-02, T-05-11-05 | One canonical path is checked, stat'ed, read and reported; a symlink escaping the workspace is refused with the target named and installs no table; `loadedPath` write-only state removed | unit (symlink escape + canonical path) | `cd .claude/mcp/vice && npm run typecheck && npm run test:automated` + the `return resolved`/`loadedPath` absence node check | ✅ extend | ⬜ pending |
| 05-12 T1 | 05-12 | 7 | DERIV-05 | **T-05-12-01**, T-05-12-03 | CIA1 joystick `confounded` derived from the DDR byte already in the buffer (any output bit, not all); raw booleans annotated not altered; CIA2 never confounded; every new field manifest-declared | unit (per-DDR-state) + manifest gate | `cd .claude/mcp/vice && npm run typecheck && npm run test:automated` + the `notes`/`confounded` manifest-shape node check | ✅ extend | ⬜ pending |
| 05-12 T2 | 05-12 | 7 | DERIV-05 | **T-05-12-02**, T-05-12-03 | `fromBcd` returns `null` on either nibble > 9; invalid fields omitted and listed in `tod.invalidBcd` with the register and raw byte in `notes`; `rawHex` always present; no out-of-range decimal reachable | unit (invalid-nibble + range sweep) + manifest gate | `cd .claude/mcp/vice && npm run typecheck && npm run test:automated` + the `tod.required` deep-equal / `0x8b`-absent node check + `node scripts/check-skill-tool-coverage.mjs` | ✅ extend | ⬜ pending |
| 05-13 T1 | 05-13 | 8 | DERIV-04, DERIV-05, DERIV-06 | **T-05-13-01**, T-05-13-04 | The banking hazard, the reported bank fields, the refusal behaviour and the VIC-bank-3 window note recorded; the side-effect claim split VERIFIED (wire body) / ASSUMED (emulator read path) — "provably" gone from both files | doc assertion + CLI gate | the parity/hazards token + anti-token grep chain, then `node scripts/check-skill-tool-coverage.mjs && npm run test:automated` | ✅ extend | ⬜ pending |
| 05-13 T2 | 05-13 | 8 | DERIV-04, DERIV-05, DERIV-06 | **T-05-13-02**, T-05-13-03 | DERIV-04/05/06 marks, traceability rows and the open count agree, with DERIV-05's premature mark annotated; `vice_disk_read_sector` reads CUT in the source doc comment **and** in `TRIMMED_TOOL_DECISIONS`'s decision-id string (D-05-24); `stock-dispatch.ts` diff comment-only, test diff exactly 1+/1- | doc assertion + diff-shape gate + full suite | the REQUIREMENTS/CUT grep chain + `git diff --numstat` shape check + `node scripts/check-skill-tool-coverage.mjs && npm run typecheck && npm run test:automated` + the invariant-count node check | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Behavior → Proof — gap closure

| Req ID | Behavior | Test Type | Automated Command | Owning Task |
|--------|----------|-----------|-------------------|-------------|
| DERIV-05 (criterion 3) | With I/O banked out (`$01 = $34`) on genuine stock VICE, `vice_vicii_get_state` still reports the true `borderColour`/`backgroundColour` and `vice_cia_get_state` the true CIA1 `portBDirection.raw` — the RAM underneath cannot produce those values | **live** (opt-in), with a CPU-view-vs-`io` non-vacuity control | `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` | 05-09 T3 |
| DERIV-05 (criterion 3) | The read goes through the emulator's own resolved `io` bank id, never a literal, and a build with no `io` bank is refused with zero MEM_GET sent | unit (wire body) + source assertion | `node --test stock-memory.test.ts stock-vicii.test.ts stock-cia.test.ts` | 05-09 T1, 05-09 T2 |
| DERIV-05 (criterion 3) | The bank the answer read is stated and enforced from the **manifest** side, so a regression to another view fails a gate not derived from the handler | manifest gate (conformance harness, `enum:["io"]`) | `node --test stock-dispatch.test.ts` | 05-09 T2 |
| DERIV-05 (criterion 3) | No CIA field reports a confident value the bytes do not support: joystick state marked `confounded` from the DDR, and a non-BCD TOD byte listed in `invalidBcd` instead of an impossible decimal | unit, per-state + range sweep | `node --test stock-cia.test.ts stock-dispatch.test.ts` | 05-12 T1, 05-12 T2 |
| DERIV-06 (criterion 4) | Sprite geometry is identical with I/O banked in and banked out, and pointer/data reads use the `ram` view the VIC-II itself fetches | **live** (opt-in) + unit (per-read wire body) | `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts`; `node --test stock-sprites.test.ts` | 05-10 T1, 05-10 T3 |
| DERIV-06 (criterion 4) | An address resolved into `$D000-$DFFF` under VIC bank 3 carries an explicit I/O-window note alongside the unchanged char-ROM note | unit, bank-3 fixture | `node --test stock-sprites.test.ts` | 05-10 T1 |
| DERIV-06 (criterion 4) | An ASCII render's legend names exactly the symbols that render emits — cross-checked against the characters actually produced, not only against the constants | unit + **live** | `node --test stock-sprites.test.ts`; `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` | 05-10 T2, 05-10 T3 |
| DERIV-04 (criterion 2) | `vice_symbols_lookup`'s answer satisfies its own declared `outputSchema` on the `address` branch, proven against the shipped manifest with a non-vacuity control | unit (schema conformance, in-file) | `node --test stock-symbols.test.ts` | 05-11 T1 |
| DERIV-04 (ASVS V12) | The containment-checked canonical path is the one opened and reported; a symlink escaping the workspace is refused and installs no table | unit (symlink escape) | `node --test stock-symbols.test.ts stock-dispatch.test.ts` | 05-11 T2 |
| Traceability (process) | `REQUIREMENTS.md`'s DERIV-04/05/06 checkboxes, traceability rows and open count agree with the landed, live-verified reality | doc assertion | the REQUIREMENTS grep chain in 05-13 T2 | 05-13 T2 |
| BACK-02 + baseline invariants (standing) | Stock manifest 34 tools, fork manifest 62, `files[]` 44, `STOCK_DERIVED_TOOLS` 9, criterion-5 gate exit 0, `test:automated` 0 fail — unmoved by every gap-closure plan | manifest/packaging gates | `node --test fork-manifest-surface.test.ts hostpath-consumers.test.ts`; `node scripts/check-skill-tool-coverage.mjs`; the invariant-count node check in each plan | every gap-closure plan's verification block |

### Shared-file ownership, waves 5-8

| File | Wave 5 (05-09) | Wave 6 (05-10 / 05-11) | Wave 7 (05-12) | Wave 8 (05-13) |
|------|----------------|------------------------|----------------|----------------|
| `stock-memory.ts` / `.test.ts` | **05-09** | — | — | — |
| `stock-vicii.ts` / `.test.ts` | **05-09** | — | — | — |
| `stock-cia.ts` / `.test.ts` | **05-09** | — | **05-12** | — |
| `stock-sprites.ts` / `.test.ts` | — | **05-10** | — | — |
| `stock-symbols.ts` / `.test.ts` | — | **05-11** | — | — |
| `tools-manifest.stock.json` | **05-09** (chip entries) | **05-10** (sprite entries) | **05-12** (CIA entry) | — |
| `stock-dispatch.test.ts` | **05-09** (harness + chip cases) | — | — | **05-13** (one data literal) |
| `stock-live.test.ts` | **05-09** | **05-10** | — | — |
| `stock-dispatch.ts` | — | — | — | **05-13** (comment) |
| `docs/stock-vice-parity.md` | — | — | — | **05-13** |
| `.claude/skills/**` | — | — | — | **05-13** |
| `.planning/REQUIREMENTS.md` | — | — | — | **05-13** |
| `package.json` | — | — | — | — (no module becomes newly reachable; `files[]` stays 44) |

**No same-wave write conflict.** Wave 6 is the only multi-plan wave, and its two plans are
disjoint: 05-10 owns `stock-sprites.*`, the sprite manifest entries and `stock-live.test.ts`;
05-11 owns `stock-symbols.*` and nothing else. `stock-sprites.ts` needs both the bank fix and
the legend fix, and both are in 05-10 for exactly this reason. `stock-cia.*`,
`tools-manifest.stock.json`, `stock-dispatch.test.ts` and `stock-live.test.ts` are each written
in more than one wave but never twice in one wave.

### Sign-Off — gap closure

- [x] All 12 gap-closure tasks carry a runnable `<automated>` verify command (Dimension 8)
- [x] No new test file is created, so waves 5-8 add no Wave 0 requirement — every command targets a file already on `main`
- [x] No new file joins `MANUAL_ONLY_TESTS`; `stock-live.test.ts` was already the fourth member
- [x] The two BLOCKER fixes (CR-01, CR-02) each carry a **live** behavioural check with an independent non-vacuity control, not only a source or wire-body assertion
- [x] Every gap in `05-VERIFICATION.md`'s `gaps:` block maps to a task: criterion 3 → 05-09 T1-T3 (+ 05-12); criterion 4 → 05-10 T1-T3
- [x] Baseline invariants (34 / 62 / 44 / 9 / criterion-5 exit 0 / 0 fail) re-asserted in every plan that could move them
- [x] No `.mts` file is touched by any gap-closure plan, so `build.ts` runs no recompile and `resources-sync.test.ts` cannot drift

**Approval:** planner-approved 2026-08-17 (gap-closure addendum; revised after plan-checker review)
