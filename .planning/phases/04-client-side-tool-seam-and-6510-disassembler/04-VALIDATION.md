---
phase: 4
slug: client-side-tool-seam-and-6510-disassembler
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-17
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `04-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map
> is filled by the planner once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` (`node --test`) — no separate test framework |
| **Config file** | none — `.claude/mcp/vice/package.json`'s `"test"` script is the only config |
| **Quick run command** | `cd .claude/mcp/vice && node --test disasm-opcodes.test.ts disasm-decoder.test.ts stock-derived.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`, excludes the 4 pre-existing `MANUAL_ONLY_TESTS`) |
| **Estimated runtime** | ~5s quick / ~60s full (round-trip test adds ACME subprocess time in CI) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (opcode table / decoder / derived-seam unit tests — all pure, no emulator, no ACME).
- **After every plan wave:** Run `npm run test:automated`. This phase's new tests must **not** be added to `MANUAL_ONLY_TESTS` (D-08 explicitly rejects that route).
- **Before `/gsd-verify-work`:** Full suite green, **plus** confirmation that CI's new ACME-install step actually *ran* the round-trip test (not merely that the step exists).
- **Max feedback latency:** ~5 seconds for the quick loop.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(filled by planner)_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Behavior → Proof (from RESEARCH.md)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DERIV-07 | Derived tool receives container path, never host-translated (`HOST_WORKSPACE_PATH` set) | unit, behavioural | `node --test stock-derived.test.ts` | ❌ Wave 0 |
| DERIV-07 | Derived module absent from `hostpath.ts`'s closed consumer set | unit, structural (mirrors `stock-paths.test.ts`) | `node --test stock-derived.test.ts` | ❌ Wave 0 |
| DISASM-01 | `vice_disassemble` returns an answer conforming to its own `outputSchema` | unit (via `stock-schema-check.ts`) | `node --test stock-disassemble.test.ts` | ❌ Wave 0 |
| DISASM-02 | **All 256** opcodes decode with correct length — exhaustive, never sampled | unit, exhaustive | `node --test disasm-opcodes.test.ts` | ❌ Wave 0 |
| DISASM-03 | Round-trip through real ACME, byte-exact; exclusions enumerated and asserted | integration, real subprocess | `node --test disasm-roundtrip.test.ts` | ❌ Wave 0 |
| DISASM-04 | Branch targets resolved to absolute addresses, not raw offsets | unit | `node --test disasm-decoder.test.ts` | ❌ Wave 0 |
| DISASM-05 | Truncation reported, never fabricated; `JMP ($xxFF)` page-wrap warning present | unit | `node --test disasm-decoder.test.ts` | ❌ Wave 0 |
| DISASM-06 | Symbol substitution only where operand role + width prove encoding-safety | unit (injected fake resolver, D-14) | `node --test disasm-decoder.test.ts` | ❌ Wave 0 |
| DISASM-07 | No new npm dependency, no GPL material; zlib provenance attributed | structural | `node scripts/check-npm-packages.mjs` (extended per D-07) | ❌ Wave 0 (extension) |

---

## Wave 0 Requirements

- [ ] `disasm-opcodes.ts` + `disasm-opcodes.test.ts` — 256-entry table plus its bit-pattern derivation test (D-06)
- [ ] `disasm-decoder.ts` + `disasm-decoder.test.ts` — pure decode; no framework install needed
- [ ] `disasm-renderer.ts` — covered by the round-trip test's use of its output
- [ ] `disasm-roundtrip.test.ts` — env-gated local skip (pattern from `stock-live.test.ts`) + CI `acme` install (D-08); **not** in `MANUAL_ONLY_TESTS`
- [ ] `stock-derived.ts` + `stock-derived.test.ts` — the DERIV-07 seam, modelled on `withStockSession()`
- [ ] `stock-disassemble.ts` + `stock-disassemble.test.ts` — the tool handler
- [ ] `.github/workflows/ci.yml` — ACME install step in the existing `build` job, before `Test`
- [ ] `THIRD-PARTY-NOTICES.md` + packaging mechanism (Open Question 2) + `scripts/check-npm-packages.mjs` extension

*No framework install required — `node:test` is already the project's runner.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `vice_disassemble` against a live stock VICE instance | DISASM-01 | Requires a running emulator; the existing 4 `MANUAL_ONLY_TESTS` establish this boundary | Launch `x64sc -binarymonitor`, call `vice_disassemble` at a known ROM address, compare against the text monitor's own `d` output |

*Everything else in this phase has automated verification. The ACME round-trip is automated in CI — it is not manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for the quick loop
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
