---
phase: 8
slug: capability-honesty-and-the-install-story
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-18
audited: 2026-08-19
manual_only_open: 1
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
| **CI-wiring guard** (added by the 2026-08-19 audit) | `cd .claude/mcp/vice && node --test ci-guardrails.test.mjs` — asserts all three guardrails above stay *blocking* steps in `.github/workflows/ci.yml` |
| **Estimated runtime** | quick: <1s (no emulator) · full gate: as per existing `test-gate.mjs` |

---

## Sampling Rate

- **After every task commit:** `cd .claude/mcp/vice && node --test capability-registry.test.ts` (sub-second, no emulator)
- **After every plan wave:** `cd .claude/mcp/vice && node test-gate.mjs` plus `node scripts/check-skill-tool-coverage.mjs` and `node scripts/check-skill-fork-honesty.mjs`
- **Before `/gsd-verify-work`:** full automated suite green, plus the manual item below signed off
- **Max feedback latency:** ~5 seconds for the quick loop

---

## Per-Task Verification Map

Filled in by the 2026-08-19 validation audit. `Wave` is the **execution** wave
(08-01 → 1; 08-02/03/04 → 2; 08-05/06 → 3), not the pre-execution "Wave 0"
test-infrastructure notion used in the section below. The requirement →
assertion mapping is unchanged from the pre-execution draft except for three
rows the audit **added** (marked *audit-added*); nothing was weakened.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 2 (`383ae23`) | 08-01 | 1 | BACK-05 | — | Refusal for a fork-only tool on stock names the tool, the reason, and `fork` | unit | `node --test capability-registry.test.ts` | ✓ | ✅ green (11/11) |
| Task 2 (`383ae23`) | 08-01 | 1 | BACK-05 | — | Refusal for a stock-only tool on fork names `stock` | unit | `node --test capability-registry.test.ts` | ✓ | ✅ green |
| Task 2 (`383ae23`) | 08-01 | 1 | BACK-05 | — | A genuinely unknown name still yields the plain `Unknown tool: X`; registry returns `undefined` | unit (regression guard) | `node --test capability-registry.test.ts` | ✓ | ✅ green |
| Task 3 (`c91588a`) | 08-01 | 1 | BACK-05 | — | *audit-added.* `capability-registry.ts` stays in `package.json` `files[]` — without it the published tarball throws `ERR_MODULE_NOT_FOUND` at the refusal path | packaging regression | `node scripts/check-npm-packages.mjs` | ✓ | ✅ green (guard existed since 08-01; the row was missing) |
| Task 2 (`ec346d8`) | 08-02 | 2 | BACK-05 | T-08 (DENY_LIST ordering) | Registry lookup runs strictly **after** the pre-existing `DENY_LIST` check in the `CallToolRequestSchema` override — never before, never instead | unit + structural | `node --test vice-proxy.test.ts` | ✓ | ✅ green (`ok 119`, observed at the wire) |
| Task 2 (`ec346d8`) | 08-02 | 2 | BACK-05 | — | Real stdio proxy under `VICE_BACKEND=stock` answers a live `tools/call` for `vice_sid_get_state` with `isError:true` and the structured text | integration | `node --test vice-proxy.test.ts` | ✓ | ✅ green (`ok 116`–`ok 118`) |
| Task 2 (`78d6051`) | 08-03 | 2 | DIST-01 | — | Generated support table is byte-identical to a fresh regeneration from both manifests + registry | unit (drift guard) | `node --test tool-support-table.test.mjs` | ✓ | ✅ green (6/6) |
| Task 2 (`78d6051`) | 08-03 | 2 | DIST-01 | — | Per-tool fork/stock columns are mechanically derived — a scratch-manifest fixture with a changed tool count changes the generated row count | structural | `node --test tool-support-table.test.mjs` | ✓ | ✅ green |
| Task 1 (`03e3308`) | 08-04 | 2 | SKILL-01 | — | Every mention of `vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore` in all six skills sits within bounded proximity of a fork-requirement sentence | lint (mechanical) | `node scripts/check-skill-fork-honesty.mjs` | ✓ | ✅ green (11 mentions / 30 files / 24 policed names) |
| Task 2 (`344a8b2`) | 08-05 | 3 | DIST-02, DIST-03 | — | `README.md` contains the literal strings `VICE_BACKEND`, `vice_sid_get_state`, `vice_keyboard_matrix` | lint (presence) | `node scripts/check-skill-fork-honesty.mjs` | ✓ | ✅ green (5 required / 3 forbidden) |
| GAP-1 | validation audit 2026-08-19 | — | SKILL-01, DIST-02, DIST-03 | — | *audit-added.* All three repo-root guardrails (`check-npm-packages`, `check-skill-tool-coverage`, `check-skill-fork-honesty`) run as **blocking** `run:` steps in `.github/workflows/ci.yml` — deleting a step or adding `continue-on-error: true` silently voids the only enforcement SKILL-01/DIST-02/DIST-03 have | structural | `cd .claude/mcp/vice && node --test ci-guardrails.test.mjs` | ✓ new | ✅ green (8/8) |
| GAP-2 | validation audit 2026-08-19 | — | DIST-01, SKILL-01 | — | *audit-added.* `docs/stock-vice-parity.md` does not regress into the five stale claims 08-06 removed (`deferred to Phase 7`, `ships in Phase 7`, `parity harness`, `must cover answer-shape drift`, `flagged here for Phase 8 planning`) and keeps its `docs/tool-support.md` pointer | lint (mechanical) | `node scripts/check-skill-fork-honesty.mjs` | ✓ extended | ✅ green (1 required / 5 forbidden) |
| — | 08-05 Task 3 (`60c25a5`) | 3 | DIST-03 | — | A human installs stock VICE from a package manager, sets the backend, and runs one skill end to end | **manual only** | see § Manual-Only Verifications | N/A | ⬜ pending (recorded, human-approved) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `.claude/mcp/vice/capability-registry.ts` + `.claude/mcp/vice/capability-registry.test.ts` — the BACK-05 data/function and its unit tests
- [x] New assertion in `.claude/mcp/vice/vice-proxy.test.ts` exercising the real `CallToolRequestSchema` override end-to-end (reuse the existing `startProxy()`/`handshake()` harness; model on the existing `tools_call`-refusal test)
- [x] `scripts/generate-tool-support-table.mjs` + a drift test (`.claude/mcp/vice/tool-support-table.test.mjs`) modelled line-for-line on `resources-sync.test.ts` (the `.mjs` extension is forced, not stylistic: a `.ts` test importing the repo-root `.mjs` generator fails `tsc --noEmit` with `TS7016`, because `.claude/mcp/vice/tsconfig.json` sets `allowJs: false` and includes only `**/*.ts` and `**/*.mts`)
- [x] `scripts/check-skill-fork-honesty.mjs` for SKILL-01's mechanical check, CI-wired alongside the existing `check-skill-tool-coverage.mjs` step
- [x] A presence-check assertion that `README.md` contains the required literal strings — may be folded into `check-skill-fork-honesty.mjs` rather than a separate file

Added by the 2026-08-19 audit (not foreseen in the pre-execution draft):

- [x] `.claude/mcp/vice/ci-guardrails.test.mjs` — the CI-wiring guard (GAP-1). `.mjs` for the same reason `tool-support-table.test.mjs` is: `.claude/mcp/vice/tsconfig.json` sets `allowJs: false` and includes only `**/*.ts` / `**/*.mts`, so a repo-root-reaching guard test belongs outside the typecheck graph. `test-gate.mjs` globs `*.test.*` and picks it up with no registration needed.
- [x] `scripts/check-skill-fork-honesty.mjs` extended with the `docs/stock-vice-parity.md` block (GAP-2) — **extended, not duplicated**, per 08-04-SUMMARY.md's "ONE place prose honesty is checked" pattern that 08-05 already followed for README.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s for the per-task loop
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** audited 2026-08-19 — 12 of 13 rows automated and green; the one
remaining row is the manual-only DIST-03 walkthrough, which carries recorded
human approval (`08-HUMAN-UAT.md` `status: pending`, and `08-VERIFICATION.md`'s
`human_verification` entry). `nyquist_compliant: true` reflects that every
requirement has automated verification; it does not close the human-UAT item.

---

## Validation Audit 2026-08-19

| Metric | Count |
|--------|-------|
| Rows audited (pre-existing) | 10 |
| Already covered and green | 9 |
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |
| Bookkeeping rows added | 1 (packaging guard that existed but was unrecorded) |
| Manual-only, still open | 1 (DIST-03 walkthrough, human-approved) |

**Gaps found and filled**

1. **GAP-1 — CI enforcement was itself unguarded.** Every SKILL-01/DIST-02/DIST-03
   control in this phase is a repo-root lint whose only enforcement is a
   `.github/workflows/ci.yml` step. Nothing asserted those steps exist or stay
   blocking, so deleting one — or adding `continue-on-error: true` — would have
   voided the control with the whole suite still green. `08-VERIFICATION.md`
   verified the wiring by a human reading line 97, which does not survive a
   later edit. Filled by `.claude/mcp/vice/ci-guardrails.test.mjs` (8 cases,
   including three fixture cases that prove the classifier can fail and a
   discovered-count-equals-3 non-vacuity control).
2. **GAP-2 — the de-staled parity doc had no regression guard.** Plan 08-06
   corrected four false forward-looking claims plus one open decision flag in
   `docs/stock-vice-parity.md`, but the stale-prose lint walks only
   `.claude/skills/` and `README.md`. The same defect class could return to
   that file unnoticed. Filled by extending
   `scripts/check-skill-fork-honesty.mjs` with a required/forbidden block whose
   five forbidden needles are verbatim quotes from 08-06-SUMMARY.md's own
   before-text table — no invented claims, and the file's legitimate historical
   `(Phase N, REQ-ID)` citations are deliberately untouched.

**Non-vacuity proofs performed** (each break reverted, `git status` confirmed clean)

| Guard | Transient break | Result |
|-------|-----------------|--------|
| `ci-guardrails.test.mjs` | added `continue-on-error: true` to the real fork-honesty step | failed, naming the offending step block |
| `ci-guardrails.test.mjs` | deleted that step's two lines | failed on both the per-script and the count-equals-3 assertion |
| fork-honesty parity block | reintroduced `deferred to Phase 7` into the parity doc | failed with the forbidden-string message |
| fork-honesty parity block | removed the `docs/tool-support.md` pointer | failed with the required-string message |

**Regression check:** `cd .claude/mcp/vice && node test-gate.mjs` → 1651 pass,
0 fail, 5 todo (todo count unchanged). `npx tsc --noEmit` → clean; the new
`.mjs` guard test is intentionally outside the typecheck graph.
