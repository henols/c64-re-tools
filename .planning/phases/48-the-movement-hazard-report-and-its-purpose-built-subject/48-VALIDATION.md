---
phase: "48"
slug: "the-movement-hazard-report-and-its-purpose-built-subject"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-12"
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`), no separate framework |
| **Config file** | none — colocated `*.test.ts` files; `package.json`'s `"test"` script is `node --test '*.test.*'` |
| **Quick run command** | `cd src/mcp/vice && node --test anno-hazard-report.test.ts` (once Wave 0 creates it) |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~10s quick · ~120s full suite |

**Do not use the bare full glob.** `npm test` blocks indefinitely on
`vice-proxy.test.ts`; `npm run test:automated` (`node test-gate.mjs`) is the
runnable suite. Never pipe it — `| tail` reports tail's exit code and fakes a
green baseline; redirect and read `$?` on the same line.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test anno-hazard-report.test.ts`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** Full suite must be green, or its skip floor explicitly compared as a SET (never a count)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

*Task IDs are filled in by the planner; the rows below bind each phase
criterion to the automated command that proves it.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01 T1 | 48-01 | 1 | BUILD-04 (crit. 1) | T-48-05 | Committed image is a pure function of committed source | integration | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` | ✅ | ✅ green |
| 48-01 T2 | 48-01 | 1 | BUILD-04 (crit. 2) | T-48-01 | Report refuses a write path | unit (structural) | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test anno-hazard-report.test.ts` | ✅ | ✅ green |
| 48-01 T3 | 48-01 | 1 | BUILD-04 (crit. 2) | T-48-03 | Store and image paths go through the existing confinement helper | integration (CLI) | `cd /home/henrik/dev/henrik/git/c64-re-tools && node scripts/check-skill-tool-coverage.mjs` | ✅ | ✅ green |
| 48-02 T1-T3 | 48-02 | 2 | BUILD-04 (crit. 1, 3) | T-48-07 | Planted constructions asserted at byte level, not via a detector | integration | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test hazard-subject-fixture.test.ts` | ✅ | ✅ green |
| 48-03 T1 | 48-03 | 2 | BUILD-04 (crit. 3) | T-48-09 | Class-1 scanner imported, not re-derived; exact call-site count | unit | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test anno-hazard-report.test.ts` | ✅ | ✅ green |
| 48-03 T2 | 48-03 | 2 | BUILD-04 (crit. 3) | T-48-02 | Existing VIC-II derivation reused; bounded walks | unit | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test anno-hazard-report.test.ts anno-graphics.test.ts` | ✅ | ✅ green |
| 48-03 T3 | 48-03 | 2 | BUILD-04 (crit. 4) | T-48-04, T-48-08 | Undecided never renders as clean; no boolean verdict shape | unit | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test anno-hazard-report.test.ts` | ✅ | ✅ green |
| 48-04 T1-T2 | 48-04 | 3 | BUILD-04 (crit. 1, 3) | T-48-07, T-48-10 | Nothing padded to make a signal fire; the deliberate miss is recorded | integration | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test hazard-subject-fixture.test.ts` | ✅ | ✅ green |
| 48-04 T3 | 48-04 | 3 | BUILD-04 (crit. 1) | T-48-11 | Committed store export carries no planning vocabulary | integration | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test hazard-subject-fixture.test.ts` | ✅ | ✅ green |
| 48-05 T1 | 48-05 | 4 | BUILD-04 (crit. 5) | T-48-07 | Zero false positives on every negative control | unit (fixture-driven) | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test anno-hazard-report.test.ts` | ✅ | ✅ green |
| 48-05 T2 | 48-05 | 4 | BUILD-04 (crit. 5) | T-48-12 | Never-observed never reads as safe; evidence strengthens only | unit | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test anno-hazard-report.test.ts` | ✅ | ✅ green |
| 48-05 T3 | 48-05 | 4 | BUILD-04 (crit. 5) | T-48-04 | Classes with no independent positive example are named as such | unit (doc-consistency) | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && node --test anno-hazard-report.test.ts` | ✅ | ✅ green |
| 48-06 T1 | 48-06 | 4 | BUILD-04 (crit. 1) | T-48-04 | Signature limit stated beside the capability, not behind it | doc-assertion | `cd /home/henrik/dev/henrik/git/c64-re-tools && grep -acE 'textbook|canonical' src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` | ✅ | ✅ green |
| 48-06 T2 | 48-06 | 4 | BUILD-04 (crit. 1) | T-48-13, T-48-14 | Assembler reached only through the host-tool seam; no host path in emitted source | integration (real ACME) | `cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && VICE_REQUIRE_ACME=1 node --test hazard-subject-reassembly.test.ts` | ✅ | ✅ green |
| 48-06 T3 | 48-06 | 4 | BUILD-04 (crit. 1) | T-48-15 | On-screen behaviour recorded against a stated prediction | manual (human-check) | see Manual-Only Verifications below | ✅ | ✅ green (48-UAT.md test 1, passed 2026-09-13) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/mcp/vice/anno-hazard-report.ts` — the new pure, read-only module (final name is the planner's choice)
- [x] `src/mcp/vice/anno-hazard-report.test.ts` — structural no-write test, per-class fire/decline tests, three-fixture cross-check
- [x] `src/mcp/vice/fixtures/hazard-subject/` — committed ACME source, assembled `.prg`, and `.annostore.json` export
- [x] The fixture design document criterion 1 requires — per-class variant choice and why it is not the textbook idiom
- [x] `src/mcp/vice/hazard-subject-fixture.test.ts` — the subject's own byte-level assertions and the regenerator-agreement byte-compare (plans 48-02, 48-04)
- [x] `src/mcp/vice/hazard-subject-reassembly.test.ts` — the multi-file export plus real-assembler round trip on the subject (plan 48-06)
- [x] `src/mcp/vice/fixtures/hazard-subject/CROSS-CHECK.md` — the committed cross-check record (plan 48-05)
- [x] Registration sites for the report's own verb. **Planner decision D48-D, recorded 2026-09-12: FOUR sites, including a CLI entry.** The three-site precedent measured here (`anno_exclude_range`/`anno_include_range`, zero `anno-cli.ts` entries) is the wrong analog — that pair is session state, and its own registry rationale says so. The right analog is `anno_evid_disagreements` / `evid-disagreements`, the one existing read-only computed query over already-fetched store data, which DOES carry a CLI verb because a CLI route runs the query against a real store. So: `anno-tools.ts` (definition, argument assertion, assertion-dispatch entry, verb-name list, dispatch arm), `anno-register.ts` (registry entry citing two real consumers and `BUILD-04`), `anno-cli.ts` (verb, closed option set, usage text, printer, command function), and the skill-doc routing entry — plus the two coupled sites a CLI verb drags with it: `ANNO_CLI_VERB_FLOOR` (5 → 6) in `scripts/lib/anno-cli-verbs.mjs` and `REAL_VERBS` in `anno-verb-coverage.test.ts`, which must move in the same commit or the deep-equal assertion reds.
- Framework install: none — `node --test` is already wired

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Subject shows visible on-screen behaviour in VICE | BUILD-04 (crit. 1) | "Visible on screen" is a human observation; the emulator-driving tests live in the MANUAL_ONLY set and are excluded from `test:automated` | Launch the subject `.prg` under stock `x64sc` via the broker, observe the documented on-screen effect, record the observation in the fixture design document |
| Mis-aligned negative control fails visibly | BUILD-04 (crit. 1, class 3) | Same — the VIC-II reading wrong bytes is an on-screen artifact, not an error signal the emulator reports | Assemble the deliberately mis-aligned variant, run it, confirm the garbled sprite/charset, record it |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter — **not set**: one manual-only
      verification (the mis-aligned negative control's visible garble) has no automated
      route and was not exercised by UAT. Phase is PARTIAL, not compliant.

**Approval:** validated (PARTIAL) — 2026-09-13

---

## Validation Audit 2026-09-13

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Measured, not assumed.** Every automated command in the Per-Task Verification Map was
executed against the working tree on 2026-09-13; each exit code was read directly, never
through a pipe.

| Suite | Result |
|---|---|
| `node --test anno-hazard-report.test.ts` | 64/64 pass |
| `node --test hazard-subject-fixture.test.ts` | 36/36 pass |
| `VICE_REQUIRE_ACME=1 node --test hazard-subject-reassembly.test.ts` | 11/11 pass |
| `node --test anno-hazard-report.test.ts anno-graphics.test.ts` | 76/76 pass |
| `node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` | exit 0, zero tree drift |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0, 6/6 anno CLI verbs resolved |

**The one gap, and why it was a gap.** Row `48-06 T1` recorded its doc-assertion as
`grep -acE 'textbook\|canonical'`. Inside an extended regular expression `\|` is an
*escaped*, therefore literal, pipe — so the command searched `FIXTURE-DESIGN.md` for the
literal string `textbook|canonical`, matched nothing, and exited 1. It would have gone red
on a correct tree, and the document it guards is in fact compliant: the unescaped
alternation matches 19 lines. The escape was corrected in place. No test was missing and
none was generated; the assertion was sound and only its recorded spelling was wrong.

**Manual-only status.** The first manual-only verification (the subject's on-screen
behaviour) was resolved by `48-UAT.md` test 1, passed 2026-09-13 — the human judged the
disclosed, investigated COMBINED-image disagreement acceptable against roadmap Success
Criterion 1. The second (the mis-aligned negative control's visible garble) remains
un-exercised: it has no automated route, and no UAT checkpoint covered it. That single
outstanding item is the whole reason this phase is PARTIAL rather than compliant.

**Suite baseline.** `npm run test:automated` reports 4310 tests, 4295 pass, 6 fail, 9
skipped. The six failures are the project's known pre-existing floor, compared as a SET
and not as a count: `anno-import.test.ts`, `anno-register.test.ts`,
`audit-integrity.test.ts`, `docs-deferred-ledger.test.ts`. Each asserts over planning-tree
bookkeeping — an archived `IMP-01` requirement id, STATE.md deferred-item rows, milestone
audit gating, docs-guard predicates. None touches this phase's code, and every one of this
phase's own suites is green.
