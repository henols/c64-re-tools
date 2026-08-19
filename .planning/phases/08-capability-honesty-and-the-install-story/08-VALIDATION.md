---
phase: 8
slug: capability-honesty-and-the-install-story
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-18
audited: 2026-08-19
manual_only_open: 0
manual_only_open_note: "Closed in Phase 8.2, plan 08.2-04: 08-HUMAN-UAT.md now carries status: passed, resolved_by: Phase 8.2, plan 08.2-04, tested_artifact_sha: 2d76867d0eb4bbb3592da99656f18389146af09b, vice_version: x64sc (VICE 3.9), evidence: 08.2-WALKTHROUGH-EVIDENCE.md. The prior Phase 8.1, plan 08.1-04 attempt (agent-driven, local-checkout-HEAD, not human-witnessed) had failed -- genuine /usr/bin/x64sc launched by this project's own broker booted with Drive8Type=0 (NONE); no MCP tool on the stock surface set it, so LOAD\"*\",8,1 returned DEVICE NOT PRESENT and the capture never completed. Plan 08.2-02 fixed the root cause (buildViceArgs()'s stock branch now emits -default -drive8type 1541 ahead of -binarymonitor), and the 08.2-04 re-run reached a full, independently-verified 65536-byte RAM capture. Driven_by: agent-proxy (not a human witness) against local-checkout HEAD, not a published release -- both stated as this run's own limitations, not glossed over. See 08-HUMAN-UAT.md and 08.2-WALKTHROUGH-EVIDENCE.md."
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
| — | 08-05 Task 3 (`60c25a5`) | 3 | DIST-03 | — | A human installs stock VICE from a package manager, sets the backend, and runs one skill end to end | **manual only** | see § Manual-Only Verifications | N/A | ✅ passed (Phase 8.2, plan 08.2-04 -- `driven_by: agent-proxy`, not a human witness; local-checkout HEAD at `2d76867d0eb4bbb3592da99656f18389146af09b`, not a published release; both limitations stated in `08-HUMAN-UAT.md` rather than glossed over) |
| GAP-5 | validation audit 2026-08-19 (second pass) | — | DIST-03 | — | *audit-added.* `buildViceArgs()`'s stock branch emits `-default -drive8type 1541` strictly ahead of `-binarymonitor` — the Phase 8.2 plan 08.2-02 fix that made the DIST-03 walkthrough row above pass (without it, `Drive8Type=0` leaves unit 8 unanswered and `LOAD"*",8,1` fails with `DEVICE NOT PRESENT`, exactly the Phase 8.1 plan 08.1-04 failure) | unit (ordering invariant) | `cd .claude/mcp/vice && node --test broker-launch.test.ts` | ✓ pre-existing, credited here | ✅ green (3 `buildViceArgs (I-2): ...` cases, ~L1787-1812) |

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

---

## Validation Audit 2026-08-19 (second pass)

> Note on the Sign-Off `Approval` paragraph above: it still reads "the one
> remaining row is the manual-only DIST-03 walkthrough... `08-HUMAN-UAT.md`
> `status: pending`". That is now stale per GAP-4 below (`08-HUMAN-UAT.md`
> carries `status: passed` as of Phase 8.2, plan 08.2-04). Left as an append
> note here rather than rewritten in place, matching this file's own
> append-only audit convention — the frontmatter (`manual_only_open: 0`) and
> the Per-Task Verification Map row are the corrected sources of truth.

| Metric | Count |
|--------|-------|
| Gaps submitted | 3 (GAP-3 new test coverage; GAP-4, GAP-5 bookkeeping corrections) |
| Resolved (test passes) | 1 (GAP-3) |
| Bookkeeping corrected | 2 (GAP-4, GAP-5) |
| Escalated | 0 |
| New assertions added | 5 (2 fixture, 3 real-file/package.json), extending `ci-guardrails.test.mjs` |
| Manual-only, still open | 0 (was 1; closed by GAP-4's correction) |

**Gaps found and filled**

3. **GAP-3 — BACK-05's only end-to-end wire proof depended on an unguarded CI
   accident.** Phase 8's headline requirement BACK-05 (success criterion 1)
   has exactly one wire-level proof: `vice-proxy.test.ts`'s `ok 116`-`ok 119`
   (search "BACK-05" in that file). That file is the second entry of
   `test-gate.mjs`'s `MANUAL_ONLY_TESTS`, so `node test-gate.mjs` — the "Full
   suite command" this very file names — never runs it; it reaches CI only
   because `.github/workflows/ci.yml`'s Test step happens to invoke bare
   `npm test` (the full `*.test.*` glob) rather than the narrower
   `npm run test:automated`. Nothing asserted that stays true, and a pending
   todo (`.planning/todos/pending/2026-08-13-reconcile-ci-test-command-with-
   narrowed-gate.md`) already documents a live intention to narrow it —
   whose own acceptance item 3 admits the exact consequence ("would then have
   none anywhere"). Filled by extending `.claude/mcp/vice/ci-guardrails.test.mjs`
   (the same file GAP-1 created, per this phase's "one place" pattern — no
   parallel guard file, no second `MANUAL_ONLY_TESTS`-shaped list) with five
   new cases: two synthetic fixtures proving the new classifier can reject a
   narrowed Test step (`npm run test:automated` and `node test-gate.mjs`
   spellings), one real-file assertion that `ci.yml`'s Test step still runs
   bare `npm test`, non-blocking, and that no step anywhere invokes the
   narrowed gate; one non-vacuity control that imports `MANUAL_ONLY_TESTS`/
   `automatedTestFiles` from `./test-gate.mjs` (not a second list) and proves
   the premise — `vice-proxy.test.ts` really is manual-only and really is
   excluded from the narrowed set today — with an explicit tripwire comment
   for the day someone moves it into the automated gate; and one assertion
   that `package.json`'s own `"test"` script still resolves to the full glob
   (the other half of the hole: redefining the npm script instead of editing
   the workflow file).

**Bookkeeping corrected (not test gaps — evidence already existed)**

4. **GAP-4 — the DIST-03 walkthrough's stale "failed" bookkeeping.** The
   frontmatter's `manual_only_open: 1` and its note, and the Per-Task
   Verification Map's last row, both still described the Phase 8.1 walkthrough
   as failed. `08-HUMAN-UAT.md` now carries `status: passed`,
   `resolved_by: Phase 8.2, plan 08.2-04`,
   `tested_artifact_sha: 2d76867d0eb4bbb3592da99656f18389146af09b`,
   `vice_version: "x64sc (VICE 3.9)"`, `evidence: 08.2-WALKTHROUGH-EVIDENCE.md`.
   Corrected: `manual_only_open: 0`, the note rewritten to record the pass and
   its evidence (while still naming the prior Phase 8.1 failure and its root
   cause, since that history is real and instructive, not something to erase),
   and the map's last row changed from "⬜ pending (recorded, human-approved)"
   to "✅ passed", explicitly stating `driven_by: agent-proxy` (not a human
   witness) against local-checkout HEAD (not a published release) — both
   named as this run's own limitations in `08-HUMAN-UAT.md` itself, not
   overstated here.
5. **GAP-5 — DIST-03's enabling code fix had automated coverage with no map
   row.** Phase 8.2 plan 08.2-02's fix — `buildViceArgs()`'s stock branch now
   emits `-default -drive8type 1541` strictly ahead of `-binarymonitor`, the
   change that made the 08.2-04 walkthrough re-run pass after the Phase 8.1
   run failed on exactly this defect — is covered by three
   `buildViceArgs (I-2): ...` tests in `.claude/mcp/vice/broker-launch.test.ts`
   (confirmed present and green at ~L1787-1812, in the automated gate). Added
   a new *audit-added* map row crediting plan 08.2-02, with
   `node --test broker-launch.test.ts` as the automated command.

**Non-vacuity proofs performed** (each break reverted, `git status` and
`diff` against a saved copy confirmed byte-identical afterward)

| Guard | Transient break | Result |
|-------|-----------------|--------|
| `ci-guardrails.test.mjs`, real-file Test-step assertion | changed `.github/workflows/ci.yml`'s Test step `run:` from `npm test` to `npm run test:automated` | failed: "found 0", naming BACK-05 and `vice-proxy.test.ts` in the message |
| `ci-guardrails.test.mjs`, same assertion | added `continue-on-error: true` to the real Test step | failed on the continue-on-error sub-assertion |
| `ci-guardrails.test.mjs`, package.json assertion | changed `.claude/mcp/vice/package.json`'s `"test"` script to `node --test '*.test.*' --exclude vice-proxy.test.ts` | failed, printing the actual (narrowed) script string |
| `ci-guardrails.test.mjs`, non-vacuity control (test #12) | could not transiently edit `test-gate.mjs` itself (implementation file, read-only) — instead ran a standalone scratch script asserting the same premise against a hand-built array with `vice-proxy.test.ts` removed | failed as expected, confirming the assertion's direction is correct (it does not vacuously pass when the premise is false) |
| synthetic fixtures (`FIXTURE_NARROWED_GATE`, `FIXTURE_NARROWED_GATE_TESTGATE_MJS`) | n/a — these fixtures are themselves the "broken" case by construction | both classifiers correctly reject them (0 full-glob matches, 1 narrowed-gate match each) |

**Regression check:** `cd .claude/mcp/vice && node --test ci-guardrails.test.mjs`
→ 13 pass, 0 fail (was 8/8 before this pass; +5 new). `cd .claude/mcp/vice &&
node test-gate.mjs` → 1663 pass, 0 fail, 5 todo (was 1658/0/5; +5 from the
same file — todo count unchanged). `cd .claude/mcp/vice && node --test
broker-launch.test.ts` → includes the 3 `buildViceArgs (I-2): ...` cases,
all green (credited to GAP-5's new row, not modified). `npx tsc --noEmit` →
clean. `node scripts/check-npm-packages.mjs`,
`node scripts/check-skill-tool-coverage.mjs`,
`node scripts/check-skill-fork-honesty.mjs` (repo root) → all exit 0,
unchanged.
