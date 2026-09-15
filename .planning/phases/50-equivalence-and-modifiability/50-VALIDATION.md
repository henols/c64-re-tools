---
phase: "50"
slug: "equivalence-and-modifiability"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-15"
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

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

**MANUAL_ONLY_TESTS floor — 12 entries** (`src/mcp/vice/test-gate.mjs:141-154`):
`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`,
`stock-live.test.ts`, `stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`,
`stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`,
`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`.
Compare the **set**, never the count. No hazard-subject or reassembly-gate test file
is on this list — those already run under `test:automated`.

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
| T1 narrowed mask + classifier | 50-01 | 1 | EQUIV-01 | T-50-01 | no process launch, no network | unit | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ❌ W0 | ⬜ pending |
| T2 allowlist + logical checkpoint | 50-01 | 1 | EQUIV-01 | T-50-02 | reason required, mask overlap refused | unit | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ❌ W0 | ⬜ pending |
| T3 byte-identity demotion + SKILL.md | 50-01 | 1 | EQUIV-01 | T-50-04 | pre-commitment guard | unit | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ❌ W0 | ⬜ pending |
| T1 regressed twin | 50-02 | 1 | EQUIV-03 | T-50-05 | argv-array spawn only | unit | `cd src/mcp/vice && node --test hazard-subject-variants.test.ts` | ❌ W0 | ⬜ pending |
| T2 modified subject | 50-02 | 1 | EQUIV-03 | T-50-06 | generator-produced, deterministic | unit | `cd src/mcp/vice && node --test hazard-subject-variants.test.ts` | ❌ W0 | ⬜ pending |
| T3 modified annostore | 50-02 | 1 | EQUIV-03 | T-50-06 | symbol-driven, refuse on drift | unit | `cd src/mcp/vice && node --test hazard-subject-variants.test.ts hazard-subject-fixture.test.ts` | ❌ W0 | ⬜ pending |
| T1 gate run, modified subject | 50-03 | 2 | EQUIV-03 | T-50-09 | one sanctioned spawn site | integration | `cd src/mcp/vice && node --test reassembly-gate-modified-run.test.ts` | ❌ W0 | ⬜ pending |
| T2 findings document | 50-03 | 2 | EQUIV-03 | T-50-08 | every value cited to an evidence line | doc assertion | `grep -ac '^\(tree_rebuild\|movement_rebuild\|hazard_disposition\|diff_scope_coverage\|red_controls\|second_path_guard\|ordering_proof\):' docs/phase50-modifiability-findings.md` | ❌ W0 | ⬜ pending |
| T3 pre-registered allowlist | 50-03 | 2 | EQUIV-03 | T-50-02 | reason required, no mask overlap | unit | `cd src/mcp/vice && node --test reassembly-gate-modified-run.test.ts` | ❌ W0 | ⬜ pending |
| T1 load-route decision | 50-04 | 2 | EQUIV-01 | T-50-10 | no auto-install, container-out seam | human decision | none — `checkpoint:decision`, `gate="blocking-human"` | ❌ W0 | ⬜ pending |
| T2 tracer: one binary end-to-end | 50-04 | 2 | EQUIV-02 | T-50-11, T-50-12 | snapshot under the tool-written root | live-emulator | `test "$(stat -c %s .../captures/original-a.bin)" = "65536"` | ❌ W0 | ⬜ pending |
| T3 mask calibration | 50-04 | 2 | EQUIV-01 | T-50-04 | mask closed after this task | live-emulator | `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` | ❌ W0 | ⬜ pending |
| T1 capture the regressed twin | 50-05 | 3 | EQUIV-01 | T-50-12 | checkpoint enumerated and removed | live-emulator | `test "$(stat -c %s .../captures/regressed.bin)" = "65536"` | ❌ W0 | ⬜ pending |
| T2 red control observed | 50-05 | 3 | EQUIV-02 | T-50-08 | exit status re-derivable | live-emulator | the `cross` run, asserted to exit 1 | ❌ W0 | ⬜ pending |
| T1 rebuild + byte-identity extra | 50-06 | 4 | EQUIV-02 | T-50-09 | no second spawn site | integration | `cd src/mcp/vice && node --test acme-verify.test.ts hazard-subject-reassembly.test.ts` | ❌ W0 | ⬜ pending |
| T2 green comparison | 50-06 | 4 | EQUIV-02 | T-50-04 | mask unchanged from the red run | live-emulator | the `cross` run, asserted to exit 0 | ❌ W0 | ⬜ pending |
| T3 modifiability observed | 50-06 | 4 | EQUIV-03 | T-50-02 | allowlist red control asserted | live-emulator | the `cross` run with and without `--allowlist` | ❌ W0 | ⬜ pending |
| T1 transcript freshness guard | 50-07 | 5 | EQUIV-04 | T-50-03 | no process launch, no network | CI unit | `cd src/mcp/vice && node --test phase50-transcript-freshness.test.ts` | ❌ W0 | ⬜ pending |
| T2 CI boundary document | 50-07 | 5 | EQUIV-04 | T-50-14 | claims traceable to a workflow step | doc assertion | `grep -ac '^## What a GitHub runner executes...' docs/phase50-ci-boundary.md` | ❌ W0 | ⬜ pending |
| T3 broken step observed red | 50-07 | 5 | EQUIV-04 | T-50-13 | break reverted, tree clean | CI unit + human-check | `cd src/mcp/vice && node --test phase50-transcript-freshness.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → behaviour map (from `50-RESEARCH.md`)

| Req ID | Behaviour that must be proven |
|--------|-------------------------------|
| EQUIV-01 | Cross-binary `compare.mjs` mode catches a planted `$D020`/`$D015`/`$D018` regression under a mask committed *before* the rebuild |
| EQUIV-02 | Paired red + green transcripts from the same mechanism. A green-only result is refused |
| EQUIV-03 | One behaviour removed, one added, observed via checkpoint/memory-read, reassembled through Phase 49's real gate, each cross-referenced to a hazard finding or moved range |
| EQUIV-04 | CI runs store→export→assemble→gate→byte-diff on committed fixtures alone. A stale transcript is caught rather than read as a pass |

---

## Wave 0 Requirements

- [ ] Committed narrowed volatile mask + allowlist module for cross-binary comparison (EQUIV-01) — does not exist today
- [ ] Modified hazard-subject `.a` / `.prg` / `.annostore` triple (EQUIV-03) — does not exist today
- [ ] A route to autostart the modified `.prg` through the sanctioned `vice_*` tool surface (`50-RESEARCH.md` Open Question 1) — does not exist today
- [ ] `docs/phase50-*.md` transcript(s) for EQUIV-02 / EQUIV-03 — do not exist today
- [ ] A CI test that compares a transcript's recorded fixture hash against the fixture's current hash — does not exist today. Model it on `resources-sync.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Original-vs-rebuild behavioural equivalence in VICE | EQUIV-02, EQUIV-03 | A GitHub runner has no emulator. The comparison is emulator-dependent by construction | Run the pipeline against genuine stock `/usr/bin/x64sc`. Capture RAM at logical checkpoints with `vice_checkpoint_add` and `vice_memory_read`. Commit the transcript under `docs/phase50-*.md`, with the fixture hash recorded in it |
| Removed / added behaviour observed taking effect | EQUIV-03 | Same — requires a running emulator | Same procedure, one transcript per change, each cross-referenced to a hazard-report finding or moved range |

The settled-screen capture technique is **not** usable here: Phase 48's
`FIXTURE-DESIGN.md` records that the subject's on-screen effects revert before any
settled capture. Use the checkpoint/memory-read procedure from
`src/skills/c64-ram-capture/SKILL.md` instead.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
