---
phase: "49"
slug: "the-reassembly-gate-committed-before-the-phase-it-gates"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false   # every gap is assigned to a named plan task; set true when those tasks land
created: "2026-09-13"
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from `49-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node:test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the driver, not a config file |
| **Quick run command** | `cd src/mcp/vice && node --test acme-verify.test.ts reassembly-gate.test.ts reassembly-gate-movement.test.ts reassembly-gate-ack.test.ts acme-seam.test.ts reassembly-gate-run.test.ts` (the phase's own files; add `anno-export-asm.test.ts anno-hazard-report.test.ts hazard-subject-reassembly.test.ts` when a task touches the modules they cover) |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~30-90 seconds (quick), full suite longer |

**Traps this phase must not fall into** (recorded, not hypothetical):

- `npm test` on the full unfiltered glob **hangs** — it blocks forever on `vice-proxy.test.ts`. Use `npm run test:automated`.
- `test:automated` **skips** the `MANUAL_ONLY_TESTS` set (`test-gate.mjs:125-146`). Compare the skip **set**, never the count.
- **Never pipe the test command** through `tail`/`head`/`grep` and read the exit code — the pipeline reports the last stage's status, faking a green baseline. Redirect to a file and read `$?` on the same line.
- A **live VICE broker reddens** at least one test deterministically. Stop the broker before trusting any suite result.

---

## Sampling Rate

- **After every task commit:** the quick run command, scoped to the files that task touched.
- **After every plan wave:** `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** full suite green (exit code read directly, not via a pipe), **and** the gate itself run for real — green, or explicitly acknowledged per criterion 5.
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Populated by the planner/executor once PLAN.md task IDs exist. Requirement for every
> row: an `<automated>` command with a stated `<fails_when>` failing direction.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1 (schema) | 49-01 | 1 | BUILD-06 | T-49-02 | Complete value sets declared in advance; no-run token can never be a pass | structural | `grep -ac '^(TREE_REBUILD\|…):' evidence/SCHEMA.md` equals 7 | ❌ W0 | ⬜ pending |
| 2 (rule table) | 49-01 | 1 | BUILD-06 | T-49-01 | Rules land in a commit with no measurement in it | structural | `grep -ac '^\*\*R[0-9]\+' evidence/DECISION-RULE.md` at least 12 | ❌ W0 | ⬜ pending |
| 1 (tree oracle) | 49-02 | 2 | BUILD-06 | T-49-04, T-49-05 | One argv-array launch site; byte-diff is the verdict; fresh output dir | unit + real assembler | `node --test acme-verify.test.ts` | ✅ file exists | ⬜ pending |
| 2 (gate module) | 49-02 | 2 | BUILD-06 | T-49-06 | Required inputs; rule id recorded; no child launch in the gate | unit | `node --test reassembly-gate.test.ts` | ❌ W0 | ⬜ pending |
| 1 (wrong byte) | 49-03 | 3 | BUILD-06 | T-49-08 | Exit-zero assembler caught by the comparison | unit + real assembler | `node --test acme-verify.test.ts` | ✅ file exists | ⬜ pending |
| 2 (stale artifact) | 49-03 | 3 | BUILD-06 | T-49-09 | Pre-existing output path refused even with correct bytes | unit | `node --test acme-verify.test.ts reassembly-gate.test.ts` | ✅/❌ mixed | ⬜ pending |
| 3 (narrowed scope) | 49-03 | 3 | BUILD-06 | T-49-08 | A clean diff over a narrowed scope is caught | unit | `node --test reassembly-gate.test.ts` | ❌ W0 | ⬜ pending |
| 1 (relocation) | 49-04 | 3 | BUILD-06 | T-49-11, T-49-13 | Every dishonest relocation refused by name; no in-place image patching | unit | `node --test reassembly-gate-movement.test.ts` | ❌ W0 | ⬜ pending |
| 2 (relocated rebuild) | 49-04 | 3 | BUILD-06 | T-49-12 | Movement exercised for real; same-address round trip refused | unit + real assembler | `node --test reassembly-gate-movement.test.ts` | ❌ W0 | ⬜ pending |
| 3 (half-moved table) | 49-04 | 3 | BUILD-06 | T-49-12 | Half-moved split table caught at the exact byte, both directions | unit + real assembler | `node --test reassembly-gate-movement.test.ts` | ❌ W0 | ⬜ pending |
| 1 (ack matching) | 49-05 | 3 | BUILD-06 | T-49-15, T-49-16 | Exactly-one match on the three-part key; order-independent | unit | `node --test reassembly-gate-ack.test.ts` | ❌ W0 | ⬜ pending |
| 2 (no silent green) | 49-05 | 3 | BUILD-06 | T-49-15, T-49-17 | Exhaustive input space: no non-clean report reaches green | unit | `node --test reassembly-gate-ack.test.ts reassembly-gate.test.ts` | ❌ W0 | ⬜ pending |
| 1 (spawn set) | 49-06 | 3 | BUILD-06 | T-49-19, T-49-20 | Assembler launch sites frozen, both-directions equality | structural | `node --test acme-seam.test.ts` | ❌ W0 | ⬜ pending |
| 2 (verify-path set) | 49-06 | 3 | BUILD-06 | T-49-21 | No second produced-versus-expected verdict path can appear | structural | `node --test acme-seam.test.ts` | ❌ W0 | ⬜ pending |
| 1 (run harness) | 49-07 | 4 | BUILD-06 | T-49-23 | Measures and prints; never asserts a token's value | integration + real assembler | `node --test reassembly-gate-run.test.ts` | ❌ W0 | ⬜ pending |
| 2 (evidence) | 49-07 | 4 | BUILD-06 | T-49-24, T-49-26 | Seven column-zero lines; ordering proved from git | structural | `cat evidence/49-*.md \| grep -acE '^(TREE_REBUILD\|…): '` equals 7 | ❌ W0 | ⬜ pending |
| 3 (verdict) | 49-07 | 4 | BUILD-06 | T-49-23, T-49-25 | Rule id recorded; frozen rules unedited; every value cited | structural + human-check | `grep -ac '^verdict: ' docs/phase49-*-findings.md` equals 1 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → criterion coverage (from RESEARCH.md)

| Criterion | Behavior | Test type | Exists? |
|-----------|----------|-----------|---------|
| 1 | Decision rules + outcome vocabulary committed **before** any measurement; `git log` proves the ordering | structural (git history inspection) | ❌ Wave 0 |
| 2 | Verdict is a byte-diff against `expectedBytes`; no exit-status / aggregate-line / stale-path shortcut; **extends** `acme-verify.ts`'s three-outcome oracle rather than minting a second | unit | ✅ file to extend; ❌ new tests |
| 3 | Gate observed **RED** on three planted controls: wrong-byte rebuild, stale output path, hazard-adjacent range outside diff scope | unit (planted violation, mirroring `acme-verify.test.ts`'s MANDATORY RED pattern) | ❌ Wave 0 |
| 4 | Movement exercised on **every** run; same-address-only round trip refused; half-moved split hi/lo table caught | unit + real ACME (`{ skip: SKIP_REASON }`) | ❌ Wave 0 — no relocation mechanism exists |
| 5 | Non-clean hazard report blocks, or passes only with per-finding acknowledgement visible in the verdict artifact | unit | ❌ Wave 0 — no acknowledgement mechanism exists |

---

## Wave 0 Requirements

Every gap below is now owned by a named plan; none is left for the executor to discover.

- [ ] `SCHEMA.md` — outcome-line vocabulary + verdict-artifact frontmatter shape, committed **first** → **49-01 task 1**
- [ ] `DECISION-RULE.md` — the first-match-wins rule table, committed alongside `SCHEMA.md`, **before any measurement** → **49-01 task 2**
- [ ] A tree-aware extension to `acme-verify.ts` (`cwd`-aware, so bare-filename `!source` lines resolve) plus its unit tests → **49-02 task 1**
- [ ] A new gate test file carrying the three planted RED controls from criterion 3 → **49-03 tasks 1-3**
- [ ] A movement/relocation mechanism and its tests — genuinely new, no prior art → **49-04 tasks 1-3**
- [ ] A hazard-finding acknowledgement mechanism and its tests — genuinely new, `HazardFinding` has no stable `id` → **49-05 tasks 1-2**
- [ ] A structural guard making "no second assembler launch site" and "no second byte-diff verdict path" checked rather than reviewed → **49-06 tasks 1-2**
- [ ] `docs/phase49-*-findings.md` — the committed, machine-readable verdict artifact Phase 50 reads → **49-07 task 3**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rules-before-measurement ordering (criterion 1) | BUILD-06 | The property is about **git commit order**, which no in-suite assertion can observe from the working tree alone | `git log --diff-filter=A --format="%ad %h %s" -- <evidence dir>/DECISION-RULE.md <evidence dir>/SCHEMA.md <verdict artifact>` — the rules' add-commit must precede the verdict's |
| Real-ACME rebuild green (phase exit condition) | BUILD-06 | Requires ACME installed on the host; the project **never auto-installs** external tools | Install ACME per `README.md`, then run the gate's real-ACME test path (not the `skip`ped one) and confirm a byte-clean verdict or a recorded acknowledgement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every runnable `<automated>` command has a `<fails_when>` naming an observable failure signal
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Test command exit code read directly, never through a pipe
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** plan-phase seeded and mapped 2026-09-13 — every task carries an `<automated>` command with a stated `<fails_when>`; awaiting execution.
