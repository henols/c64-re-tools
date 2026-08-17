---
phase: 4
slug: client-side-tool-seam-and-6510-disassembler
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-17
updated: 2026-08-17
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `04-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map
> below was filled by the planner once the seven PLAN.md files existed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` (`node --test`) — no separate test framework |
| **Config file** | none — `.claude/mcp/vice/package.json`'s `"test"` script is the only config |
| **Quick run command** | `cd .claude/mcp/vice && node --test disasm-opcodes.test.ts disasm-decoder.test.ts disasm-renderer.test.ts stock-derived.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`, excludes the 4 pre-existing `MANUAL_ONLY_TESTS`) |
| **Estimated runtime** | ~5s quick / ~60s full (round-trip adds ACME subprocess time in CI) |

---

## Sampling Rate

- **After every task commit:** the quick run command (opcode table / decoder / renderer / derived-seam unit tests — all pure, no emulator, no ACME).
- **After every plan wave:** `cd .claude/mcp/vice && npm run test:automated`. This phase's new tests are **not** added to `MANUAL_ONLY_TESTS` (D-08 explicitly rejects that route); `test-gate.test.ts`'s drift guard confirms each new file joined the automated set.
- **Standing per-phase regression gate (BACK-02):** every wave also runs `npm run typecheck`, `npm run smoke` and `node --test fork-manifest-surface.test.ts` — the fork surface must stay at 62 tools.
- **Shipping-closure gate, every wave that merges to `main` (Phase 3 Rule 2):** `.github/workflows/ci.yml`'s `release-on-merge` job auto-publishes both npm packages on **every** push to `main` unless the commit **subject** carries `[skip release]`, and each execution wave merges before the next forks. So a wave that adds an import without adding its target to `.claude/mcp/vice/package.json`'s `files[]` publishes a tarball that throws `ERR_MODULE_NOT_FOUND` at module load — on **both** backends, since `vice-proxy.ts:177` imports `stock-dispatch.ts` statically and unconditionally. Neither `npm run test:automated` nor `npm run smoke` can see this: both run against the repo filesystem, not the packed tarball. Run the transitive-closure check (embedded in 04-02 T2 and 04-05 T3's `<automated>` blocks, and permanent in `check-npm-packages.mjs` from 04-07) before every wave merge. Verified clean against the pre-phase tree at 27 modules, so it is not vacuous.
- **Before `/gsd-verify-work`:** full suite green, **plus** confirmation that CI's new ACME-install step actually *ran* the round-trip test (not merely that the step exists).
- **Max feedback latency:** ~5 seconds for the quick loop.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01 T1 | 04-01 | 1 | DISASM-02 | T-04-01-02, T-04-01-03 | Opcode data transcribed from zlib-licensed cc65 only, never VICE; zero imports; provenance in the header | smoke (inline) | `cd .claude/mcp/vice && npm run typecheck` + the 256-entry inline node check | ❌ new | ⬜ pending |
| 04-01 T2 | 04-01 | 1 | DISASM-02 | T-04-01-01 | All 256 lengths pinned by a derivation independent of the transcription source; 27 NOP-class and 12 JAM opcodes asserted by value and count | unit, exhaustive | `cd .claude/mcp/vice && node --test disasm-opcodes.test.ts` | ❌ new | ⬜ pending |
| 04-02 T1 | 04-02 | 1 | DERIV-07 | T-04-02-01, T-04-02-04 | `derivedContainerPath()` returns the container path unchanged and refuses undeclared tools; no `hostpath.ts` import | source assertion + typecheck | `cd .claude/mcp/vice && npm run typecheck` + the comment-stripped `hostpath` grep | ❌ new | ⬜ pending |
| 04-02 T2 | 04-02 | 1 | DERIV-07 | T-04-02-02, T-04-02-03, **T-04-02-06** | `needsSession:false` never reaches `ensureStockSession()`; handler exceptions convert, never escape; derived handler receives the container path (with a proven non-vacuity control); **`stock-derived.ts` added to `files[]` in the same commit as the import** | unit, behavioural + packaging closure | `cd .claude/mcp/vice && node --test stock-dispatch.test.ts stock-derived.test.ts` + the inline shipping-closure check | ❌ new + ✅ extend | ⬜ pending |
| 04-02 T3 | 04-02 | 1 | DERIV-07 | T-04-02-01 | `hostpath.ts`'s production importer set is exactly five modules and the derived family is absent | unit, structural | `cd .claude/mcp/vice && node --test hostpath-consumers.test.ts` | ❌ new | ⬜ pending |
| 04-03 T1 | 04-03 | 2 | DISASM-02, DISASM-04, DISASM-05 | T-04-03-01, T-04-03-02 | Bounded by construction, no recursion; never fabricates operand bytes; never throws | smoke (inline) | `cd .claude/mcp/vice && npm run typecheck` + the branch/truncation inline node check | ❌ new | ⬜ pending |
| 04-03 T2 | 04-03 | 2 | DISASM-04, DISASM-05 | T-04-03-03, T-04-03-04 | Branch targets resolved at both signed extremes and both 16-bit wraps; truncation reported; page-wrap flagged; 256-opcode length invariant | unit | `cd .claude/mcp/vice && node --test disasm-opcodes.test.ts disasm-decoder.test.ts` | ❌ new | ⬜ pending |
| 04-04 T1 | 04-04 | 3 | DISASM-03, DISASM-06 | T-04-04-01, T-04-04-02 | Width invariant forced where the assembler could shrink; nothing emitted that ACME cannot express | unit (via T2) | `cd .claude/mcp/vice && npm run typecheck && node --test disasm-renderer.test.ts` | ❌ new | ⬜ pending |
| 04-04 T2 | 04-04 | 3 | DISASM-03, DISASM-06 | T-04-04-03, T-04-04-04 | Symbols substitute only in absolute/indirect/branch operands, never immediate or zeropage; every substituted name is defined; byte continuity across `!byte` substitutions | unit | `cd .claude/mcp/vice && node --test disasm-opcodes.test.ts disasm-decoder.test.ts disasm-renderer.test.ts` | ❌ new | ⬜ pending |
| 04-05 T1 | 04-05 | 4 | DISASM-06 | — | One resolver holder answers both symbol directions; `parseAddress()` behaviour unchanged | unit | `cd .claude/mcp/vice && node --test stock-address.test.ts` | ✅ extend | ⬜ pending |
| 04-05 T2 | 04-05 | 4 | DISASM-01, DISASM-06 | T-04-05-01, T-04-05-02, T-04-05-04, T-04-05-05 | `address`/`count`/`end` through the one parser; `end`+`count` refused; `sidefx:false` hardcoded; no unrequested resume | unit | `cd .claude/mcp/vice && node --test stock-disassemble.test.ts` | ❌ new | ⬜ pending |
| 04-05 T3 | 04-05 | 4 | DISASM-01 | T-04-05-03, T-04-05-06, T-04-05-07, **T-04-05-08** | Answer conforms to its own `outputSchema`; bounded at 100 instructions with `limitReached`/`nextAddress`; derived path proven not to host-translate; **`stock-disassemble.ts` + the three `disasm-*.ts` it transitively pulls in added to `files[]` in the same commit as the import** | unit (schema conformance harness) + packaging closure | `cd .claude/mcp/vice && node --test stock-disassemble.test.ts stock-dispatch.test.ts hostpath-consumers.test.ts fork-manifest-surface.test.ts && npm run smoke` + the inline shipping-closure check | ❌ new + ✅ extend | ⬜ pending |
| 04-06 T1 | 04-06 | 5 | DISASM-03 | T-04-06-03, T-04-06-05 | ACME installed from the distribution archive and verified by its own banner; a missing ACME fails the job | CLI / workflow assertion | `grep -c 'apt-get install -y acme' .github/workflows/ci.yml` + `node --test test-gate.test.ts` | ❌ new step | ⬜ pending |
| 04-06 T2 | 04-06 | 5 | DISASM-03 | T-04-06-01, T-04-06-02, T-04-06-04 | argv-array subprocess only; byte-exact round-trip over all 256 opcodes; substitution table asserted in both directions | integration, real subprocess | `cd .claude/mcp/vice && node --test disasm-roundtrip.test.ts` | ❌ new | ⬜ pending |
| 04-07 T1 | 04-07 | 6 | DISASM-07 | T-04-07-01 | zlib provenance attributed; no GPL material incorporated; ACME stated as a test-only subprocess | CLI assertion | the notices `grep`/`test -f` chain in the task's verify block | ❌ new | ⬜ pending |
| 04-07 T2 | 04-07 | 6 | DISASM-07 | T-04-07-01, T-04-07-02, T-04-07-03 | Notices file present; all five modules still present (regression guard); **transitive-closure walk from `vice-proxy.ts` makes Rule 2 a permanent machine gate**; runtime dependency set unchanged | packaging gate | `node scripts/check-npm-packages.mjs` | ✅ extend | ⬜ pending |
| 04-07 T3 | 04-07 | 6 | DISASM-07 | T-04-07-04 | Every Phase 4 divergence enumerated for Phase 8's parity harness | doc assertion | the `docs/stock-vice-parity.md` `grep` chain in the task's verify block | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Behavior → Proof

| Req ID | Behavior | Test Type | Automated Command | Owning Task |
|--------|----------|-----------|-------------------|-------------|
| DERIV-07 | Derived tool receives the container path, never host-translated (`HOST_WORKSPACE_PATH` set, with a non-vacuity control) | unit, behavioural | `node --test stock-derived.test.ts` | 04-02 T2 |
| DERIV-07 | Derived module absent from `hostpath.ts`'s closed production consumer set | unit, structural | `node --test hostpath-consumers.test.ts` | 04-02 T3 |
| DISASM-01 | `vice_disassemble` returns an answer conforming to its own `outputSchema` through the real `dispatchStock` path | unit (via `stock-schema-check.ts`) | `node --test stock-dispatch.test.ts` | 04-05 T3 |
| DISASM-02 | **All 256** opcodes decode with correct length — exhaustive, never sampled; the 27-opcode NOP class enumerated (**not** "twelve") | unit, exhaustive | `node --test disasm-opcodes.test.ts disasm-decoder.test.ts` | 04-01 T2, 04-03 T2 |
| DISASM-03 | Round-trip through a real ACME, byte-exact; exclusions enumerated and asserted in both directions | integration, real subprocess | `node --test disasm-roundtrip.test.ts` | 04-06 T2 |
| DISASM-04 | Branch targets resolved to absolute addresses, not raw offsets | unit | `node --test disasm-decoder.test.ts` | 04-03 T2 |
| DISASM-05 | Truncation reported, never fabricated; `JMP ($xxFF)` page-wrap warning present | unit | `node --test disasm-decoder.test.ts` | 04-03 T2 |
| DISASM-06 | Symbol substitution only where operand role and width prove encoding-safety; wired to the one resolver hook | unit (injected fake resolver, D-14) | `node --test disasm-renderer.test.ts stock-disassemble.test.ts` | 04-04 T2, 04-05 T2 |
| DISASM-07 | No new npm dependency, no GPL material; zlib provenance attributed and shipped | packaging gate | `node scripts/check-npm-packages.mjs` | 04-07 T2 |

---

## Shipping Correctness: how `package.json` writes are distributed

Phase 3's Rule 2 binds a module to `files[]` at the commit that makes it
**reachable from the shipped entry point** (`vice-proxy.ts`), not at the end of the
phase. Reachability by wave, and therefore who writes `package.json`:

| Wave | Plan | New module created | Reachable from `vice-proxy.ts` yet? | Writes `package.json`? |
|------|------|--------------------|--------------------------------------|-------------------------|
| 1 | 04-01 | `disasm-opcodes.ts` | no — nothing imports it | **no** |
| 1 | 04-02 | `stock-derived.ts` | **yes** — `stock-dispatch.ts` imports it | **yes** (+1, adds `stock-derived.ts`) |
| 2 | 04-03 | `disasm-decoder.ts` | no — nothing imports it | **no** |
| 3 | 04-04 | `disasm-renderer.ts` | no — nothing imports it | **no** |
| 4 | 04-05 | `stock-disassemble.ts` | **yes**, and it transitively pulls in the renderer, decoder and opcode table | **yes** (+4) |
| 5 | 04-06 | (tests + CI only) | n/a | **no** |
| 6 | 04-07 | `THIRD-PARTY-NOTICES.md` | n/a (data file) | **yes** (+1, notices only) |

`files[]` entry count: **33** at phase start → 34 after 04-02 → 38 after 04-05 →
**39** after 04-07.

**No same-wave write conflict.** `package.json` is written in waves 1, 4 and 6.
Wave 1 is the only multi-plan wave, and its other plan (04-01) does **not** write
`package.json` — truthfully, because `disasm-opcodes.ts` is not reachable from any
shipped module until 04-05 wires the tool. Waves 4 and 6 are single-plan. The
wave structure is unchanged by this revision.

04-03 and 04-04 each carry an explicit written instruction **not** to touch
`package.json`, with the reachability reason, so an executor does not
"helpfully" add an entry and create a conflict with a later plan's edit.

## Wave 0 Requirements

Every file below is created by the plan named beside it — there is no separate
Wave 0 scaffold pass, because each plan creates its own test file in the same plan
as the code it covers. No `<automated>` command in any task references a test file
that its own plan (or an earlier wave's plan) does not create.

- [ ] `disasm-opcodes.ts` + `disasm-opcodes.test.ts` — **04-01** (wave 1)
- [ ] `stock-derived.ts` + `stock-derived.test.ts` + `hostpath-consumers.test.ts` — **04-02** (wave 1)
- [ ] `disasm-decoder.ts` + `disasm-decoder.test.ts` — **04-03** (wave 2)
- [ ] `disasm-renderer.ts` + `disasm-renderer.test.ts` — **04-04** (wave 3)
- [ ] `stock-disassemble.ts` + `stock-disassemble.test.ts` + the manifest/dispatch/conformance updates — **04-05** (wave 4)
- [ ] `disasm-roundtrip.test.ts` + the CI ACME step — **04-06** (wave 5); env-gated local skip, `VICE_REQUIRE_ACME=1` hard gate in CI; **not** in `MANUAL_ONLY_TESTS`
- [ ] `THIRD-PARTY-NOTICES.md` + the packaging gate + the parity-doc entries — **04-07** (wave 6)

*No framework install required — `node:test` is already the project's runner.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `vice_disassemble` against a live stock VICE instance | DISASM-01 | Requires a running emulator; the existing 4 `MANUAL_ONLY_TESTS` establish this boundary | Launch `/usr/bin/x64sc -binarymonitor`, call `vice_disassemble` at a known KERNAL address (e.g. `$FFD2`), compare against the text monitor's own `d` output |
| CI's ACME step actually *ran* the round-trip | DISASM-03 | Only observable on the PR's Actions log | On the PR, open the `build` job and confirm the `Install ACME cross-assembler` step succeeded AND the round-trip suites reported as executed rather than skipped |

`workflow.human_verify_mode` is `end-of-phase`, so both rows are verified once at
the phase boundary rather than as in-plan checkpoints. Everything else in this
phase has automated verification; the ACME round-trip is automated in CI — it is
not manual.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every one of the 17 tasks has one)
- [x] Wave 0 covers all MISSING references (each plan creates the test file its own commands invoke)
- [x] No watch-mode flags
- [x] Feedback latency < 10s for the quick loop
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-08-17
