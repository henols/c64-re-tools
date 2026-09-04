---
phase: "37"
slug: "the-importer-and-the-automatic-annotation-join"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-05"
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `37-RESEARCH.md` § *Validation Architecture*. The planner fills the
> Per-Task Verification Map once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `package.json`'s `scripts.test` / `scripts["test:automated"]` |
| **Quick run command** | `cd src/mcp/vice && node --test <file>.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` (== `node test-gate.mjs`) |
| **Estimated runtime** | ~120 seconds for the full gate |

**Two standing constraints on the full-suite number (both measured, both project memories):**

1. `npm test` over the full glob **hangs** on `vice-proxy.test.ts` — it outlives the Bash
   timeout. `npm run test:automated` is the runnable target.
2. **A live VICE broker deterministically reddens the BACK-05 test.** Stop the broker before
   trusting any suite result; a red BACK-05 with a running broker is not a regression.

---

## Sampling Rate

- **After every task commit:** the specific new test file(s) that task touches —
  `node --test anno-import.test.ts` / `node --test anno-join.test.ts`
- **After every plan wave:** `npm run test:automated`
- **Before `/gsd-verify-work`:** full suite at the measured floor
- **Max feedback latency:** ~10 seconds for a single test file

**Measured floor this phase inherits (run 2026-09-05): 3409 tests, 3396 pass, 2 fail, both in
`anno-register.test.ts`.** The floor is a pair of pre-existing failures in one named file — it is
not zero, and asserting zero is a known way to redden a correct tree. A failure anywhere *else*
is a regression. Re-measure the floor rather than pinning 3409/3396/2 as magic numbers.

---

## Per-Task Verification Map

*Populated by the planner once task IDs exist. Every requirement below must appear against at
least one task with a runnable `<automated>` command and a `<fails_when>` sibling.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | IMP-01 | T-37-01 | Transfer-file path confined to workspace root via the existing `resolveWorkspacePath()` | unit | `node --test anno-import.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | IMP-02 | T-37-03 | Delete strictly after `applyWrite()`'s commit returns — never delete-then-write | unit | `node --test anno-import.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-01 | — | N/A | integration | `node --test anno-join.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-02 | — | N/A | unit + planted-violation | `node --test anno-join.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-03 | — | N/A | unit + planted-violation | `node --test anno-join.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-04 | — | N/A | integration | `node --test anno-join.test.ts` + live case | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-05 | — | N/A | unit + planted-violation | `node --test anno-join.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-06 | — | N/A | unit | `node --test anno-join.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-07 | — | N/A | manual_procedural (live) | `MANUAL_ONLY_TESTS`-gated, live Ghidra | ❌ W0 | ⬜ pending |
| TBD | — | 2 | AUTO-08 | — | N/A | unit | `node --test anno-join.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Observed-Red Controls (the six that make this phase's criteria worth anything)

Three of this phase's rules fail **silently** — each was got wrong on the first attempt during
the pivot exploration and produced plausible, confident, *wrong* comments rather than an error.
A criterion that only asserts the fix is worthless here.

**Each red transcript is a deliverable of a task SEPARATE from the task that implements the
fix.** Batching them into "the controls are in place" is the named failure mode
(`.planning/research/PITFALLS.md` § *Pitfall 23*, ROADMAP.md Phase 37 Notes).

| # | Control | Mutation that must be observed reddening it | Observable "red" signal |
|---|---------|---------------------------------------------|-------------------------|
| 1 | Narrowest-range-wins (AUTO-02) | Switch selection to first-match | `$D020` annotates as the 4096-byte I/O-area entry, not the 1-byte border-colour entry |
| 2 | Narrowest-range-wins (AUTO-02) | Switch selection to longest-description | same — `$D020` resolves to a wider containing entry |
| 3 | `sym` tie-break (AUTO-02) | Reverse the tie-break among equal-width contenders | the contender *without* a `sym` wins (measured real tie exists at `$0000`) |
| 4 | In-image skip (AUTO-03) | Remove the image-range check | ordinary loop-back branch targets annotate as machine features again |
| 5 | Bank decode (AUTO-04) | Bypass the `$01` bits 0-2 decode | the `$34`/`$33` flip stops changing the annotation — a `$d020` write under `$34` is labelled the border colour |
| 6 | Path-dependent decline (AUTO-05) | Replace the decline with a forward-carried value | an annotation is emitted where the join should have declined with a reason |

Plus AUTO-07's own present/absent proof, which is an observation rather than a mutation:
phantom labels a graphics region mints when decoded as code are **present before** the `-b`
data-block feedback and **absent after**.

**Evidence convention:** red transcripts land under
`.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/`, named
`37-NN-<control>-red.md`, matching the convention Phases 33–36 already use (e.g.
`36-01-sleigh-gate-red.md`).

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/anno-import.ts` + `anno-import.test.ts` — transfer-file parser and importer tool (IMP-01, IMP-02)
- [ ] `src/mcp/vice/anno-join.ts` + `anno-join.test.ts` — the three selection rules, bank decode, graphics derivation (AUTO-01..06, AUTO-08)
- [ ] `src/mcp/vice/fixtures/ghidra/` — the synthetic two-caller path-dependent `$01` fixture (`.a` + committed `.prg`). **An early task**: `bank.a` is MEASURED to have no path-dependent site, so verifying the flip/decline against it produces a vacuous control.
- [ ] An additive `GhidraStructExport.java` section carrying **addressed** `$01`-literal facts — a hard prerequisite for AUTO-04/AUTO-05 to have real data to assert against. `DECOMPILED_TEXT` today gives `DAT_0001 = 0x37;` with **no per-statement address**.
- [ ] A Ghidra pre-script capability marking a range as data, for AUTO-07's Ghidra-side feedback half — new script logic, no framework install.

No test-framework install is needed: `node --test` is already the substrate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phantom labels present-before / absent-after the `-b` feedback | AUTO-07 | Requires a real Ghidra + dxa run over a real charset region; the label set is an emergent property of the disassembler, not a stub | `MANUAL_ONLY_TESTS`-gated case: run the analyser over the real binary without feedback, capture minted labels inside the derived charset range; re-run with `-b` blocks and Ghidra data-marking applied; assert the same label set is empty. Record both transcripts as evidence. |
| The `$34`/`$33` bank flip over a live analysed capture | AUTO-04 | The hermetic half is automatable; the end-to-end half needs a real Ghidra analysis of the synthetic fixture | `MANUAL_ONLY_TESTS`-gated, `GHIDRA_HOME` set. The hermetic case in `anno-join.test.ts` remains the primary gate. |

**`test:automated` skips `MANUAL_ONLY_TESTS` — a manual-only case is invisible to CI.** Anything
routed here must also carry a hermetic automated counterpart, or the requirement has no gate.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every runnable `<automated>` command has a `<fails_when>` sibling naming its failure signal
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] Each of the six observed-red controls has its own task, separate from the task that implements the fix
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s for the per-task quick command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
