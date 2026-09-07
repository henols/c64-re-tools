---
phase: "39"
slug: "the-dual-channel-coexistence-gate-go-degrade-no-go"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-07"
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — project-wide standard, colocated `*.test.ts` |
| **Config file** | none — matches every other `*.test.ts` in `src/mcp/vice/` |
| **Quick run command** | `node --test src/mcp/vice/textmon-fixtures.test.ts` (once Wave 0 creates it) |
| **Full suite command** | `npm run test:automated` (gated by `src/mcp/vice/test-gate.mjs`) — **never** `npm test`; the whole-glob run does not terminate unaided |
| **Estimated runtime** | ~60 seconds for `test:automated`; ~2 seconds for the single-file quick run |

**Measured baseline, not a clean floor.** The `test:automated` baseline on this
host is **2 failing tests in `anno-register.test.ts`**, from a cause no phase in
this milestone created. Do not write "clean floor: 0" into any acceptance
criterion — assert the relation (no *new* failures beyond the recorded baseline),
never an absolute count.

---

## Sampling Rate

- **After every task commit:** Run `node --test src/mcp/vice/textmon-fixtures.test.ts` (once that file exists; before it exists, the per-task verify is the task's own grep/`git log` assertion)
- **After every plan wave:** Run `npm run test:automated`, compared against the recorded baseline
- **Before `/gsd-verify-work`:** `test:automated` shows no failures beyond the recorded 2-in-1 baseline
- **Max feedback latency:** 60 seconds

**Live-run precondition (D-16).** Every measuring task is taken with the broker
stopped — `systemctl --user is-active vice-broker` must not report `active`. A
live broker reddens the `BACK-05` ordering assertion deterministically, so a
measurement taken against a live-broker run reads a false baseline and must be
discarded and re-run rather than repaired. Each evidence transcript records
`BROKER_STATE:` and the `test:automated` count it was taken against.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | CHAN-01 | — | — | — | *populated by validate-phase once plans exist* | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Plans do not exist at seed time; the planner authors each task's `<automated>`
verify plus its `<fails_when>` sibling, and `/gsd-validate-phase` fills this
table from them.

---

## Wave 0 Requirements

- [ ] `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/DECISION-RULE.md` — the go/degrade/no-go rules (D-01, D-09..D-11)
- [ ] `.planning/phases/39-.../evidence/SCHEMA.md` — the seven gate inputs, their frozen value domains and the column-0 transcription rule (D-02, D-03, D-07)
- [ ] `.planning/phases/39-.../evidence/README.md` — evidence conventions, `BROKER_STATE:` / `TEST_AUTOMATED_BASELINE:`, the voided-run rule and the ordering proof (D-07, D-16)
- [ ] `.planning/phases/39-.../evidence/` totality-walk script — enumerates the 3,888-tuple cross-product and asserts exactly one antecedent per tuple (D-04)
- [ ] `src/mcp/vice/fixtures/textmon/` — does not exist; created by the fixture-capture plan (D-18)
- [ ] `src/mcp/vice/textmon-fixtures.ts` — sibling loader, does not exist; `binmon-fixtures.ts` is not extended (D-18)
- [ ] `src/mcp/vice/textmon-fixtures.test.ts` — the one new corpus-free automated test (D-19)

No test framework install is needed — `node --test` is already the project standard.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rules commit precedes every measurement commit | CHAN-01 (criterion 1) | Ordering is a git-history property, and D-01 explicitly chose git order as the proof with **no test guard** | `git log --oneline -- <evidence dir>` — the commit carrying `DECISION-RULE.md`/`SCHEMA.md` must precede every commit carrying an outcome line |
| The seven gate inputs are each recorded at column 0 of their own evidence file | CHAN-01 (criteria 2, 3) | The transcription rule (final occurrence wins, one declared source file per line) is read by humans and by grep, not by a suite | Per `SCHEMA.md`'s own conventions: grep each input name at column 0; an absent line is an incomplete phase, never a default |
| The verdict is mechanically re-derivable from the recorded inputs | CHAN-01 (criterion 4) | A reader walks the committed rule over the recorded values; D-06 declined a test guard on the downstream binding | Read `docs/phase39-dual-channel-coexistence-gate-findings.md` frontmatter, apply `DECISION-RULE.md` in order, confirm `verdict_rule_applied` matches |
| Five live coexistence experiments run with both channels live | CHAN-01 (criterion 2) | Requires a real emulator process and two live sockets; D-19 declined adding a live suite to `MANUAL_ONLY_TESTS` | Run each probe script with the broker stopped; the script's own column-0 outcome line is the record |

**Zero new `MANUAL_ONLY_TESTS` entries is the default expectation (D-19).** If a
plan nevertheless writes a live-capture suite, its file is added to
`src/mcp/vice/test-gate.mjs`'s `MANUAL_ONLY_TESTS` **and** to the count
assertion in `src/mcp/vice/test-gate.test.ts` **in the same commit** — that
union guard fails in both directions.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every runnable `<automated>` command has a `<fails_when>` sibling naming an observable failure signal
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] No acceptance criterion asserts an absolute `test:automated` failure count of 0
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
