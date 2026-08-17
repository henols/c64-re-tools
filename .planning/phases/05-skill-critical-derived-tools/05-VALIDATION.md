---
phase: 5
slug: skill-critical-derived-tools
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-17
updated: 2026-08-17
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `05-RESEARCH.md` § Validation Architecture. The **Per-Task Verification
> Map** below was filled by the planner once the eight PLAN.md files existed — every task
> lands in it with an `<automated>` command, and no command references a test file its own
> plan (or an earlier wave's plan) does not create.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 22 tasks carry one
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (each plan creates the test file its own commands invoke)
- [x] No watch-mode flags
- [x] Feedback latency < 10s for the quick loop (~5s measured shape, matching Phase 4's)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Every phase success criterion has a named owner: criterion 1 → 05-01 + 05-06; criterion 2 → 05-02 + 05-06; criterion 3 → 05-03 + 05-04 + 05-07 (two independent mechanisms); criterion 4 → 05-05 + 05-07; criterion 5 → 05-08 (mechanised per D-05-05)
- [x] Every requirement id (DERIV-01, DERIV-04, DERIV-05, DERIV-06) appears in at least one plan's `requirements` field

**Approval:** planner-approved 2026-08-17
