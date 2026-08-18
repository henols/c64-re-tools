---
phase: 8
slug: capability-honesty-and-the-install-story
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `.claude/mcp/vice/package.json:58` (`"test": "node --test '*.test.*'"`) |
| **Quick run command** | `cd .claude/mcp/vice && node --test capability-registry.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && node test-gate.mjs` |
| **Repo-root doc/package guardrails** | `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-npm-packages.mjs`, and the new `node scripts/check-skill-fork-honesty.mjs` |
| **Estimated runtime** | quick: <1s (no emulator) · full gate: as per existing `test-gate.mjs` |

---

## Sampling Rate

- **After every task commit:** `cd .claude/mcp/vice && node --test capability-registry.test.ts` (sub-second, no emulator)
- **After every plan wave:** `cd .claude/mcp/vice && node test-gate.mjs` plus `node scripts/check-skill-tool-coverage.mjs` and `node scripts/check-skill-fork-honesty.mjs`
- **Before `/gsd-verify-work`:** full automated suite green, plus the manual item below signed off
- **Max feedback latency:** ~5 seconds for the quick loop

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table is completed during execution as
tasks land. The requirement → assertion mapping below is fixed and must not be
weakened.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | BACK-05 | — | Refusal for a fork-only tool on stock names the tool, the reason, and `fork` | unit | `node --test capability-registry.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | BACK-05 | — | Refusal for a stock-only tool on fork names `stock` | unit | `node --test capability-registry.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | BACK-05 | — | A genuinely unknown name still yields the plain `Unknown tool: X`; registry returns `undefined` | unit (regression guard) | `node --test capability-registry.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | BACK-05 | T-08 (DENY_LIST ordering) | Registry lookup runs strictly **after** the pre-existing `DENY_LIST` check in the `CallToolRequestSchema` override — never before, never instead | unit + structural | `node --test vice-proxy.test.ts` | ✓ harness / ❌ case | ⬜ pending |
| TBD | TBD | 1 | BACK-05 | — | Real stdio proxy under `VICE_BACKEND=stock` answers a live `tools/call` for `vice_sid_get_state` with `isError:true` and the structured text | integration | `node --test vice-proxy.test.ts` (reuse `startProxy()`/`handshake()`) | ✓ harness / ❌ case | ⬜ pending |
| TBD | TBD | 0 | DIST-01 | — | Generated support table is byte-identical to a fresh regeneration from both manifests + registry | unit (drift guard) | `node --test tool-support-table.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | DIST-01 | — | Per-tool fork/stock columns are mechanically derived — a scratch-manifest fixture with a changed tool count changes the generated row count | structural | `node --test tool-support-table.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | SKILL-01 | — | Every mention of `vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore` in all six skills sits within bounded proximity of a fork-requirement sentence | lint (mechanical) | `node scripts/check-skill-fork-honesty.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | DIST-02, DIST-03 | — | `README.md` contains the literal strings `VICE_BACKEND`, `vice_sid_get_state`, `vice_keyboard_matrix` | lint (presence) | `node scripts/check-skill-fork-honesty.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DIST-03 | — | A human installs stock VICE from a package manager, sets the backend, and runs one skill end to end | **manual only** | see § Manual-Only Verifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.claude/mcp/vice/capability-registry.ts` + `.claude/mcp/vice/capability-registry.test.ts` — the BACK-05 data/function and its unit tests
- [ ] New assertion in `.claude/mcp/vice/vice-proxy.test.ts` exercising the real `CallToolRequestSchema` override end-to-end (reuse the existing `startProxy()`/`handshake()` harness; model on the existing `tools_call`-refusal test)
- [ ] `scripts/generate-tool-support-table.mjs` + a drift test (`.claude/mcp/vice/tool-support-table.test.ts`) modelled line-for-line on `resources-sync.test.ts`
- [ ] `scripts/check-skill-fork-honesty.mjs` for SKILL-01's mechanical check, CI-wired alongside the existing `check-skill-tool-coverage.mjs` step
- [ ] A presence-check assertion that `README.md` contains the required literal strings — may be folded into `check-skill-fork-honesty.mjs` rather than a separate file

**Reuse mandate (D-D):** `scripts/check-skill-tool-coverage.mjs`'s
`FORK_ONLY_UNRECOVERABLE` array already holds 3 of the registry's entries
verbatim, and its own header comment says DIST-01 is expected to reuse that
extraction rather than re-derive it. Wave 0 must consolidate, not duplicate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A user installs the plugin and a working VICE from a package manager by following only the documentation | DIST-03 (success criterion 3) | It is a claim about a human successfully following prose on a machine this project does not control. The mechanical presence/table checks are a strong proxy, not proof. | On a clean or containerized Debian/Ubuntu box: `apt install vice`, install the plugin per README, select the stock backend, then run `c64-ram-capture`'s entry-point procedure end to end. Record the outcome in `08-HUMAN-UAT.md` (same shape as Phase 7's). |

---

## Security Notes (ASVS L1)

- **V4 Access Control — not an authorization boundary.** The capability registry is a
  read-only lookup for message text. It must never be treated as, or substituted for,
  an access-control check.
- **V5 Input Validation — the ordering invariant is the control.** The registry lookup
  takes the same untrusted `request.params.name` every other lookup in `vice-proxy.ts`
  already handles as a plain string key. It must never be interpolated into anything
  executed, nor used to build a filesystem path. Critically, it must run **strictly
  after** the pre-existing `DENY_LIST` check (`vice-proxy.ts` `CallToolRequestSchema`
  override) so the already-closed confused-deputy bypass via `tools_call`/`initialize`
  is not reopened. This ordering has a dedicated test row above.
- **Information disclosure — bounded by policy.** The registry may contain only
  information already public in `docs/stock-vice-parity.md` and the public repo. No
  credential, secret, or unpublished tool name goes in it.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s for the per-task loop
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
