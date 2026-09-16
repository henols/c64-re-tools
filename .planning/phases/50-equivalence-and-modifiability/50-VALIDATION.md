---
phase: "50"
slug: "equivalence-and-modifiability"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-15"
validated: "2026-09-16"
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Audited 2026-09-16 against the eight executed plans. See the audit trail at
> the foot of this file for what the plan-time draft got wrong.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — colocated `*.test.ts` files next to the module under test |
| **Quick run command** | `cd src/mcp/vice && npm run test:automated` |
| **Full suite command** | `cd src/mcp/vice && npm test` — **CI / devcontainer only** |
| **Estimated runtime** | ~60–120 seconds for `test:automated` |

**Known hazard — the full glob hangs locally.** `.github/workflows/ci.yml:158-178`
records that CI deliberately runs the wide `npm test` glob because two suites hang
locally outside a devcontainer. Use `npm run test:automated` for every local
iteration in this phase. Reserve bare `npm test` for CI.

**MANUAL_ONLY_TESTS floor — 12 entries** (`src/mcp/vice/test-gate.mjs:141-154`,
re-read and confirmed unchanged 2026-09-16):
`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`,
`stock-live.test.ts`, `stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`,
`stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`,
`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`.
Compare the **set**, never the count. No phase-50 test file is on this list —
every one of them runs under both `test:automated` and CI's wider `npm test` glob.

**Stop the broker before trusting any result.** A live `vice-broker` reddens an
unrelated back-pressure test deterministically. Every measurement recorded in this
file was taken with `pgrep -af 'vice-broker|x64sc'` empty and the user unit inactive.

**Read the exit code on the same line.** Piping a run through `tail`/`head` reports
the pipe's status, not the suite's, and fakes a green baseline. Every count below
was taken with `> file 2>&1; echo "EXIT=$?"`.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && npm run test:automated`
- **After every plan wave:** Run `npm run test:automated`, plus one explicit
  opted-in run of any new live-emulator test added by that wave
- **Before `/gsd-verify-work`:** Full suite green under CI's own
  `VICE_REQUIRE_ACME=1` environment
- **Max feedback latency:** ~120 seconds

Live-emulator transcript evidence is committed separately and is **not** asserted
by the automated suite. Per the ROADMAP's criterion 5, CI compares a transcript's
recorded fixture hash against the fixture's current hash. CI does not read the
transcript's content.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T1 narrowed mask + classifier | 50-01 | 1 | EQUIV-01 | T-50-01 | no process launch, no network | unit | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ✅ | ✅ green |
| T2 allowlist + logical checkpoint | 50-01 | 1 | EQUIV-01 | T-50-02 | reason required, mask overlap refused | unit | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ✅ | ✅ green |
| T3 byte-identity demotion + SKILL.md | 50-01 | 1 | EQUIV-01 | T-50-04 | pre-commitment guard | unit | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ✅ | ✅ green |
| T1 regressed twin | 50-02 | 1 | EQUIV-03 | T-50-05 | argv-array spawn only | unit | `cd src/mcp/vice && node --test hazard-subject-variants.test.ts` | ✅ | ✅ green |
| T2 modified subject | 50-02 | 1 | EQUIV-03 | T-50-06 | generator-produced, deterministic | unit | `cd src/mcp/vice && node --test hazard-subject-variants.test.ts` | ✅ | ✅ green |
| T3 modified annostore | 50-02 | 1 | EQUIV-03 | T-50-06 | symbol-driven, refuse on drift | unit | `cd src/mcp/vice && node --test hazard-subject-variants.test.ts hazard-subject-fixture.test.ts` | ✅ | ✅ green |
| T1 gate run, modified subject | 50-03 | 2 | EQUIV-03 | T-50-09 | one sanctioned spawn site | integration | `cd src/mcp/vice && node --test reassembly-gate-modified-run.test.ts` | ✅ | ✅ green |
| T2 findings document | 50-03 | 2 | EQUIV-03 | T-50-08 | every value cited to an evidence line | doc contract | `cd src/mcp/vice && node --test phase50-findings-contract.test.ts` | ✅ | ✅ green |
| T3 pre-registered allowlist | 50-03 | 2 | EQUIV-03 | T-50-02 | reason required, no mask overlap | unit | `cd src/mcp/vice && node --test reassembly-gate-modified-run.test.ts` | ✅ | ✅ green |
| T1 load-route decision | 50-04 | 2 | EQUIV-01 | T-50-10 | no auto-install, container-out seam | human decision | none — `checkpoint:decision`, `gate="blocking-human"`; recorded in `evidence/LOAD-ROUTE.md` | ✅ | ✅ green |
| T2 tracer: one binary end-to-end | 50-04 | 2 | EQUIV-02 | T-50-11, T-50-12 | snapshot under the tool-written root | live-emulator | `test "$(stat -c %s .../captures/original-a.bin)" = "65536"`; transcript guarded by `phase50-transcript-freshness.test.ts` | ✅ | ✅ green |
| T3 mask calibration | 50-04 | 2 | EQUIV-01 | T-50-04 | mask closed after this task | live-emulator | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ✅ | ✅ green |
| T1 capture the regressed twin | 50-05 | 3 | EQUIV-01 | T-50-12 | checkpoint enumerated and removed | live-emulator | `test "$(stat -c %s .../captures/regressed.bin)" = "65536"`; transcript guarded by `phase50-transcript-freshness.test.ts` | ✅ | ✅ green |
| T2 red control observed | 50-05 | 3 | EQUIV-02 | T-50-08 | exit status re-derivable | live-emulator | the `cross` run, asserted to exit 1; green-without-red REFUSED by `phase50-transcript-freshness.test.ts` | ✅ | ✅ green |
| T1 rebuild + byte-identity extra | 50-06 | 4 | EQUIV-02 | T-50-09 | no second spawn site | integration | `cd src/mcp/vice && node --test acme-verify.test.ts hazard-subject-reassembly.test.ts` | ✅ | ✅ green |
| T2 green comparison | 50-06 | 4 | EQUIV-02 | T-50-04 | mask unchanged from the red run | live-emulator | the `cross` run, asserted to exit 0 | ✅ | ✅ green |
| T3 modifiability observed | 50-06 | 4 | EQUIV-03 | T-50-02 | allowlist red control asserted | live-emulator + unit | the `cross` run with and without `--allowlist`; statically proven by `reassembly-gate-modified-run.test.ts` | ✅ | ✅ green |
| T1 transcript freshness guard | 50-07 | 5 | EQUIV-04 | T-50-03 | no process launch, no network | CI unit | `cd src/mcp/vice && node --test phase50-transcript-freshness.test.ts` | ✅ | ✅ green |
| T2 CI boundary document | 50-07 | 5 | EQUIV-04 | T-50-14 | claims traceable to a workflow step | doc contract | `cd src/mcp/vice && node --test phase50-findings-contract.test.ts` | ✅ | ✅ green |
| T3 broken step observed red | 50-07 | 5 | EQUIV-04 | T-50-13 | break reverted, tree clean | CI unit + human-check | `cd src/mcp/vice && node --test phase50-transcript-freshness.test.ts` | ✅ | ✅ green |
| T1 exported-source edit | 50-08 | 6 | EQUIV-03 | T-50-06 | manifest-driven, every other file byte-unchanged | unit | `cd src/mcp/vice && node --test hazard-subject-exported-edit.test.ts` | ✅ | ✅ green |
| T2 gate run, exported-edit subject | 50-08 | 6 | EQUIV-03 | T-50-09 | unmodified gate module, one sanctioned spawn site | integration | `cd src/mcp/vice && node --test reassembly-gate-exported-edit-run.test.ts` | ✅ | ✅ green |
| T3 exported-edit observed live | 50-08 | 6 | EQUIV-03 | T-50-12 | pre-registered allowlist, every row attributed | live-emulator | the `cross` run with and without `--allowlist`; transcript guarded by `phase50-transcript-freshness.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Measured 2026-09-16**, broker inactive, exit code read on the same line:

| Command | tests | pass | fail | skipped | exit |
|---------|-------|------|------|---------|------|
| `node --test hazard-subject-variants.test.ts hazard-subject-fixture.test.ts reassembly-gate-modified-run.test.ts phase50-transcript-freshness.test.ts hazard-subject-exported-edit.test.ts reassembly-gate-exported-edit-run.test.ts hazard-subject-reassembly.test.ts` | 93 | 93 | 0 | 0 | 0 |
| `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | 23 | 23 | 0 | 0 | 0 |
| `node --test text-protocol.test.ts text-tools.test.ts stock-derived.test.ts hostpath-consumers.test.ts acme-verify.test.ts` | 172 | 171 | 0 | 1 | 0 |
| `node --test stock-dispatch.test.ts` | 123 | 123 | 0 | 0 | 0 |
| `node --test phase50-findings-contract.test.ts` | 8 | 8 | 0 | 0 | 0 |

The one skip is `text-tools.test.ts`'s `vice_memmap_zap` live case, opt-in and
default-skipped by design (`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc` runs it).

### Requirement → behaviour map (from `50-RESEARCH.md`)

| Req ID | Behaviour that must be proven | Coverage |
|--------|-------------------------------|----------|
| EQUIV-01 | Cross-binary `compare.mjs` mode catches a planted `$D020`/`$D015`/`$D018` regression under a mask committed *before* the rebuild | COVERED |
| EQUIV-02 | Paired red + green transcripts from the same mechanism. A green-only result is refused | COVERED |
| EQUIV-03 | One behaviour removed, one added, observed via checkpoint/memory-read, reassembled through Phase 49's real gate, each cross-referenced to a hazard finding or moved range | COVERED (closed by 50-08; document contract closed 2026-09-16) |
| EQUIV-04 | CI runs store→export→assemble→gate→byte-diff on committed fixtures alone. A stale transcript is caught rather than read as a pass | COVERED |

---

## Wave 0 Requirements

- [x] Committed narrowed volatile mask + allowlist module for cross-binary comparison (EQUIV-01) — `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs`
- [x] Modified hazard-subject `.a` / `.prg` / `.annostore` triple (EQUIV-03) — under `src/mcp/vice/fixtures/hazard-subject/`
- [x] A route to autostart the modified `.prg` through the sanctioned `vice_*` tool surface — decided in `evidence/LOAD-ROUTE.md`, delivered as the widened `vice_program_load`
- [x] `docs/phase50-*.md` transcript(s) for EQUIV-02 / EQUIV-03 — three committed: equivalence, modifiability, exported-modifiability
- [x] A CI test that compares a transcript's recorded fixture hash against the fixture's current hash — `src/mcp/vice/phase50-transcript-freshness.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Original-vs-rebuild behavioural equivalence in VICE | EQUIV-02, EQUIV-03 | A GitHub runner has no emulator. The comparison is emulator-dependent by construction | Run the pipeline against genuine stock `/usr/bin/x64sc`. Capture RAM at logical checkpoints with `vice_checkpoint_add` and `vice_memory_read`. Commit the transcript under `docs/phase50-*.md`, with the fixture hash recorded in it |
| Removed / added behaviour observed taking effect | EQUIV-03 | Same — requires a running emulator | Same procedure, one transcript per change, each cross-referenced to a hazard-report finding or moved range |

**These two entries are why `nyquist_compliant` is `false`, and they are
irreducible rather than a backlog item.** The behavioural observation itself
cannot run on a GitHub runner. What *is* automated is everything reachable
without an emulator: the transcripts' freshness against the fixture hash, their
orphan status, the refusal of a green result that carries no paired red control,
and — since 2026-09-16 — the contract of the two machine-readable verdict
documents. Chasing `nyquist_compliant: true` here would mean deleting the
emulator half of the phase, not strengthening it.

The settled-screen capture technique is **not** usable here: Phase 48's
`FIXTURE-DESIGN.md` records that the subject's on-screen effects revert before any
settled capture. Use the checkpoint/memory-read procedure from
`src/skills/c64-ram-capture/SKILL.md` instead.

---

## Validation Audit 2026-09-16

| Metric | Count |
|--------|-------|
| Gaps found | 4 |
| Resolved | 4 |
| Escalated | 0 |

**Gaps, and what closed each.**

1. **G1 — a broken automated command that would have reddened a correct
   document.** Plan 50-03 T2's row carried
   `grep -ac '^\(tree_rebuild\|…\):' docs/phase50-modifiability-findings.md`,
   anchored at **column 0**. It returns `0`, not `7`: the seven keys are
   indented under an `inputs:` mapping in the YAML frontmatter. The corrected
   form `grep -c '^\s*\(…\):'` returns `7`. The document's own body had already
   recorded this correction; the validation contract had not. The row now names
   a real test instead of a grep. **Do not re-anchor that key match at column 0.**

2. **G2 — plan 50-08 was absent from the map entirely.** The plan that *closes*
   `EQUIV-03` shipped `hazard-subject-exported-edit.test.ts` and
   `reassembly-gate-exported-edit-run.test.ts`, both green, and neither had a
   row. Three rows added.

3. **G3 — the two EQUIV-03 verdict documents had no contract guard.**
   `docs/phase50-modifiability-findings.md` and
   `docs/phase50-exported-edit-findings.md` are the requirement's
   machine-readable deliverable, and each states that its transcription rule
   "is the whole basis of the verdict's honesty". Their *substance* is
   re-derived in-process by the two gate-run tests, but the transcription step
   was unguarded, and `phase50-transcript-freshness.test.ts` excludes them by
   design as "not a transcript". Closed by `phase50-findings-contract.test.ts`.

4. **G4 — the CI boundary document's section could vanish silently.**
   `docs/phase50-ci-boundary.md`'s only stated assertion was a bare
   `grep -ac '^## What a GitHub runner executes'`, wired into no test. Closed by
   the same new file.

**New test file:** `src/mcp/vice/phase50-findings-contract.test.ts` — 8 tests,
8 pass, 0 fail, exit 0; `npx tsc --noEmit` exit 0. It guards the guard (asserting
the real `docs/` holds exactly the two expected findings documents, so a rename
cannot make the negative cases vacuous) and carries four negative cases plus an
empty-directory case that must fail rather than pass vacuously.

**Non-vacuity proven against the real tree, not only against fixtures.**
`ordering_proof: held` was temporarily flipped to `red` in the committed
`docs/phase50-exported-edit-findings.md`; the suite exited **1** and named the
file, the key and the expected value. The document was restored with
`git checkout --` and the tree verified clean.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter — **deliberately not set.**
      Two irreducible emulator-dependent verifications remain manual-only; see
      the Manual-Only table for why this is the phase's floor, not a gap.

**Approval:** validated 2026-09-16 — PARTIAL (21 automated rows, 2 irreducible
manual-only behaviours).
