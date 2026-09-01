---
phase: 29
slug: the-mcp-surface
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-29
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `29-RESEARCH.md` § "Validation Architecture" (measured this tree, 2026-08-29).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node:test`) — no separate framework |
| **Config file** | none; the automated set is derived by `src/mcp/vice/test-gate.mjs` |
| **Quick run command** | `cd src/mcp/vice && node --test hostpath-consumers.test.ts stock-dispatch.test.ts tool-support-table.test.mjs capability-registry.test.ts module-classification.test.ts docs-linerefs.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` (= `node test-gate.mjs`) |
| **Full glob command** | `cd src/mcp/vice && npm test` (= `node --test '*.test.*'`) — includes the 9 manual-only/live files |
| **CI scripts** | `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-fork-honesty.mjs`, `node scripts/check-npm-packages.mjs`, `node scripts/audit-gate.mjs` |
| **Typecheck** | `cd src/mcp/vice && npm run typecheck` (`tsc --noEmit`) |
| **Estimated runtime** | ~1.2 s (quick, measured) · ~15 s (CI scripts) · ~660 s (full glob) |

### Measured baselines (this tree, 2026-08-29)

| Command | Result | Wall time |
|---|---|---|
| `node --test` over the 10 files this phase touches | **201 tests, 200 pass, 0 fail, 1 skipped** | **1.24 s** |
| `node scripts/check-skill-tool-coverage.mjs` | `OK` — 37 `vice_*` / 17 `anno_*` / 8 CLI verbs, 8/8 resolved | < 5 s |
| `node scripts/check-skill-fork-honesty.mjs` | `OK` — 11 fork-only mentions, 24 names policed | < 5 s |
| `node scripts/check-npm-packages.mjs` | `OK` — closure 60 modules; 80 + 34 files | ~15 s |
| `npm test` (full glob) | **not re-measured** — ~660 s, `vice-proxy` hang, ~44-failure baseline on a host with no emulator | ~660 s |

**Baseline discipline (blocking):** the full-glob suite has a **non-zero failure
baseline**, and a *live* VICE broker makes `BACK-05`'s test fail deterministically.
**Record the failure count before the phase starts and compare against it** — never
expect zero, and never use the full glob as a per-task loop. Stop the broker before
trusting any full-suite result.

---

## Sampling Rate

- **After every task commit:** the quick run command above — measured **~1.2 s**
- **After every plan wave:** `npm run test:automated` **plus** all four `scripts/check-*.mjs` **plus** `npm run typecheck`
- **Before `/gsd-verify-work`:** full `npm test` (whole glob, **broker stopped**), all four CI scripts, `docs/tool-support.md` byte-identical, all `docs-*.test.ts` green
- **Max feedback latency:** 5 seconds

**Consequence the plan must exploit:** the structural guards that carry
`MCP-02`/`MCP-03`/`MCP-05` run in 1.24 s. There is no reason to defer them to a
phase gate — per-task verification is affordable.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled by `/gsd-validate-phase` once PLAN.md task ids exist)* | | | | | | | | | ⬜ pending |

### Requirement → test map (from research, pre-task-assignment)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | manifest-derived surface: every `curated`/`adapt` verb routed, every `omit` absent, `delete_project_enum` absent, checked mechanically | unit | `node --test anno-derivation.test.ts` | ❌ W0 (re-points `anno-derivation.test.ts`) |
| MCP-01 | verbs the manifest does not classify appear in a committed register with a requirement id | unit | `node --test anno-register.test.ts` | ❌ W0 (models `module-classification.test.ts`) |
| MCP-02 | the runner's body contains none of `forwardToVice`/`ensureViceSession`/`rewriteArguments` | structural | `node --test stock-dispatch.test.ts` | ✅ re-point |
| MCP-02 | no new module imports `hostpath.ts` (consumer set stays exactly 5) | structural | `node --test hostpath-consumers.test.ts` | ✅ |
| MCP-03 | `BACKEND_SEAM_BYPASS_KEYS` ordered `deepEqual` | structural | `node --test stock-dispatch.test.ts` | ✅ re-point |
| MCP-03 | no `anno_*` name in either manifest | structural | `node --test stock-dispatch.test.ts` | ✅ re-point |
| MCP-03 | `docs/tool-support.md` byte-identical | structural | `node --test tool-support-table.test.mjs` | ✅ proven byte-identical in research |
| MCP-04 | idempotent write: same edit twice → second returns `changed: false`, `isError: false` | unit | `node --test anno-tools.test.ts` | ❌ W0 |
| MCP-04 | batch pre-validates recursively and refuses WHOLE on an uncurated inner name at any depth | unit | `node --test anno-tools.test.ts` | ❌ W0 (port `anno-tools.test.ts` batch cases) |
| MCP-04 | batch execution returns per-item status and does not abort on the first failure | unit | `node --test anno-tools.test.ts` | ❌ W0 |
| MCP-04 | ambiguous/unsupported request returns `{available:false, reason}`, never `[]` and never `0` | unit | `node --test anno-tools.test.ts` | ❌ W0 |
| MCP-05 | all three `ANNO_TOOL_DEFINITIONS` witnesses moved; generator throws (not silently differs) if one did not | structural | `node --test tool-support-table.test.mjs capability-registry.test.ts` | ✅ re-point |
| MCP-05 | `ANNO_MODULE_FLOOR` re-expressed with a real positive control | structural | `node --test hostpath-consumers.test.ts` | ✅ re-point |
| STORE-06 | `anno_get_cross_references(to)` returns every deriving address, union'd with stored non-derivable rows | unit | `node --test anno-derive.test.ts` | ❌ W0 |
| STORE-06 | search finds a term in a label, a comment and an instruction; each corpus independently disableable | unit | `node --test anno-derive.test.ts` | ❌ W0 |
| STORE-06 | `max_results` is required and the returned count makes truncation detectable | unit | `node --test anno-derive.test.ts` | ❌ W0 |
| STORE-06 | **nothing cached:** after any derived query, `anno_xref` row count and store file mtime/bytes are unchanged | structural | `node --test anno-derive.test.ts` | ❌ W0 |
| D-01 / CUT-02 | the grep gate bites on planted violations and is green over the untouched exemption set | structural + planted | `node scripts/check-no-analyser.mjs` | ❌ W0 |
| D-02 / FLOW-01 | the renamed CLI's verbs are parsed from its own switch, with a floor, and every one is named by a skill file | structural | `node --test anno-verb-coverage.test.ts` | ❌ W0 (ports `anno-verb-coverage.test.ts`) |

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/anno-tools.test.ts` — MCP-04 (idempotency, batch, refusal shape)
- [ ] `src/mcp/vice/anno-derivation.test.ts` — MCP-01 (the manifest check; re-points `anno-derivation.test.ts`)
- [ ] `src/mcp/vice/anno-register.test.ts` — MCP-01 (the second register; models `module-classification.test.ts`)
- [ ] `src/mcp/vice/anno-derive.test.ts` — STORE-06 (xrefs, search, **the never-cached control**)
- [ ] `src/mcp/vice/anno-verb-coverage.test.ts` — FLOW-01 over the renamed CLI (ports `anno-verb-coverage.test.ts`)
- [ ] `scripts/lib/anno-cli-verbs.mjs` — replaces the deleted `anno-cli-verbs.mjs`; carry `stripComments()` verbatim
- [ ] `scripts/check-no-analyser.mjs` — the grep gate plus its exemption non-vacuity counter
- [ ] No framework install needed — `node:test` is already the runner.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The grep gate is **observed red** on a planted violation and reverted | D-01 / CUT-02 | Project convention: structural guards are proven by a planted violation observed red, never by inspection. The red observation is a transcript artifact, not an assertion. | Plant each of the 4 violation shapes named in `29-RESEARCH.md` § Discretion 1, run `node scripts/check-no-analyser.mjs`, record the non-zero exit and the message, `git checkout` the plant. Must happen **before** the deletion commit. |
| Full-glob suite compared against a **recorded pre-phase baseline** | all | ~660 s, non-zero failure baseline on an emulator-less host; a live broker reds `BACK-05` deterministically | Stop the VICE broker. Run `npm test` before the phase's first commit, record the failure count, and diff against it at the phase gate. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
