---
phase: 30
slug: acme-export-and-the-real-acme-oracle
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `30-RESEARCH.md` § Validation Architecture (measured live, 2026-08-30).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no external framework |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the automated-subset seam |
| **Quick run command** | `cd src/mcp/vice && npm run test:automated` |
| **Full suite command** | `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` (CI's command) |
| **Estimated runtime** | ~45 seconds (quick); full glob is longer |

**Measured baseline, 2026-08-30:** 2771 tests / 2765 pass / **0 fail** / 1 skipped / 5 todo / 45.4 s.
**The clean floor is 0 failures.** Any red this phase introduces is this phase's.

**Standing hazards (project memory — honour both):**
- A **live VICE broker reddens the BACK-05 test deterministically.** Stop the broker before
  trusting any suite result. It is not a flake.
- `npm test` (full glob) **blocks forever** on `vice-proxy.test.ts` under a bash timeout. Use
  `npm run test:automated` for per-task sampling; run the full glob only at the phase gate,
  where it is CI's command and is expected to take its time.

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && npm run test:automated`
- **After every plan wave:** the same, plus `cd src/mcp/vice && npm run typecheck`
- **Before `/gsd-verify-work` (phase gate):** full suite green under
  `VICE_REQUIRE_ACME=1` — this is the **Phase 27 ACME hard-fail gate at this phase's
  boundary**, which the ROADMAP requires — plus `node scripts/check-npm-packages.mjs`,
  `check-no-regenerator2000.mjs`, `check-skill-tool-coverage.mjs`,
  `check-skill-cli-invocations.mjs`, `check-skill-fork-honesty.mjs`
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is completed against `*-PLAN.md` at
execution time. The requirement→behaviour rows below are the **contract** each task's
`<verify>` must satisfy.

| Behaviour | Requirement | Threat Ref | Secure Behaviour | Test Type | Automated Command | File Exists | Status |
|-----------|-------------|------------|------------------|-----------|-------------------|-------------|--------|
| With `ACME_BIN` bogus, verification reports skipped-or-failed and **never** a pass | EXPORT-01 | T-30-01 | A missing assembler is a third outcome, never `ok` | integration (child process) | `node --test acme-verify.test.ts` | ❌ W0 | ⬜ pending |
| Restoring the exit-code shortcut makes that test **fail** (non-vacuity control) | EXPORT-01 | T-30-01 | The guard is provably able to bite | planted violation | same file | ❌ W0 | ⬜ pending |
| A corrupted export byte fails the byte-diff **while ACME exits 0** | EXPORT-01 | — | Verdict never derives from exit status | integration (real ACME) | same file | ❌ W0 | ⬜ pending |
| Verdict never reads `exitStatus`; `"skipped"` is a third outcome; unanimity across ACME's own result lines; refuse to guess on >1 authoritative line | EXPORT-01 | — | The five verdict rules, each independently tested | unit | same file | ❌ W0 | ⬜ pending |
| Output file must have been created **by this run** (fresh `mkdtemp`) — the stale-output false pass | EXPORT-01 | T-30-04 | ACME leaves a pre-existing output file untouched on failure | unit + integration | same file | ❌ W0 | ⬜ pending |
| `assertAcmeRequiredIfEnvSet()` hard-FAILs under `VICE_REQUIRE_ACME` | EXPORT-01 | — | Skip-vs-fail imported from the gate, never re-probed | never-skipped gate | one test per new ACME-dependent file | ✅ `acme-gate.ts` exists; call sites new | ⬜ pending |
| `=*+$01` on a fixture that **actually contains self-modifying code** reassembles byte-identically | EXPORT-02 | — | Label placement (before the host instruction) is load-bearing; ACME exits 0 either way | integration (real ACME) | `node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| The exporter **reads** `AUTO_NAME_PREFIX_RE` rather than restating prefixes | EXPORT-02 | — | No five-prefix reimplementation | structural (source scan) | same file | ❌ W0 | ⬜ pending |
| All **eleven** typed prefixes survive a round trip through the export | EXPORT-02 | — | `routine-queue-walker`'s backlog signal still recognises `p_`, `j_`, `s_`, `b_`, `r_`, `zpf_` | integration | same file | ❌ W0 | ⬜ pending |
| Every `acmeExpressible: false` opcode exports as `!byte $xx` with a naming comment and round-trips | EXPORT-03 | — | Never an invented mnemonic | integration (real ACME), table-driven from `OPCODES` | same file | ✅ precedent: `disasm-roundtrip.test.ts` Suite C | ⬜ pending |
| Every block asserts `*` equals its original address | EXPORT-03 | — | A ZP-literal→label substitution cannot silently widen and shift following code | integration (real ACME) | same file | ❌ W0 | ⬜ pending |
| An enum renders on the **immediate** operand only | EXPORT-03 | — | Reassembly byte-identity is the control that catches the wrong-operand case | integration | same file | ❌ W0 | ⬜ pending |
| Correctness is never claimed from a string match on the exporter's own output | EXPORT-03 | — | The verdict function has no `.includes()` against export text | structural | `node --test acme-verify.test.ts` | ❌ W0 | ⬜ pending |
| A duplicate label is **refused by the store**; with the refusal removed, **real ACME reports the duplicate-symbol error** | EXPORT-03 | T-30-05 | External oracle confirms the internal one | integration (planted violation + real ACME) | `node --test anno-export-asm.test.ts` | partial: refusal exists (`anno-types.ts`) | ⬜ pending |
| Every caller-supplied path (`--store`, image, `--out`) goes through `storePathWithinWorkspace()` and the **realpath it returns** is used | EXPORT-01 | T-30-02/03 | Phase 29 found three live escapes of exactly this shape | inventory audit | `node --test anno-cli-path-consumers.test.ts` | ✅ exists | ⬜ pending |
| `assertCommentText()` refuses **embedded newlines** (not only a leading `;`) | EXPORT-03 | T-30-06 | An embedded `\n` in a stored comment would emit arbitrary ACME source | unit | `node --test anno-types.test.ts` | ✅ file exists; **control unconfirmed — the plan must check it** | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/acme-verify.test.ts` — EXPORT-01 (both mandatory reds), criterion 1, criterion 5
- [ ] `src/mcp/vice/anno-export-asm.test.ts` — EXPORT-02, EXPORT-03, criterion 4
- [ ] A **self-modifying-code fixture** with a known-good byte image — criterion 3 requires
      "a fixture that actually contains self-modifying code"; emitting the idiom is not enough
- [ ] `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/` — the two
      **re-recorded** transcripts (honest pass, false-pass trap) from **real ACME output**,
      plus a README recording ACME 0.97 provenance and stating that the Phase 29 fixtures at
      `.planning/phases/29-the-mcp-surface/fixtures/` were read **for shape only** and are
      never asserted against
- [ ] Framework install: **none** — `node --test` is already in use

**Do not add either new test file to `MANUAL_ONLY_TESTS`.** `test-gate.mjs`'s
`automatedTestFiles()` globs `*.test.*` and subtracts that list; a new file is auto-discovered,
and `test-gate.test.ts`'s drift guard fails the build if a file escapes both sets.

---

## Manual-Only Verifications

| Behaviour | Requirement | Why Manual | Test Instructions |
|-----------|-------------|------------|-------------------|
| — | — | — | — |

**All phase behaviours have automated verification.** Real ACME 0.97 is present on this host
(`/home/henrik/.local/bin/acme`) and CI installs it (`.github/workflows/ci.yml:78`), so the
oracle runs unattended in both places. No VICE emulator participates in this phase.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
