# Requirements: c64-re-tools — v0.4.0

**Defined:** 2026-08-21
**Milestone:** v0.4.0 Debt discharged, decisions settled
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
*(Under active review this milestone — see `CORE-01`.)*

**Milestone goal:** Stop inheriting the same ledger a third time. Every carried
item becomes a fix or a dated decision, and the two questions this project has
answered *by default* each milestone get answered deliberately.

**Numbering note:** `EXTV`, `GATE`, `FORK`, `DEBT`, `CORE` and `PKG` are new
categories opened for v0.4.0. Where a requirement discharges an older ID
(`VERIF-02`, `BACK-01`/`BACK-04`, `QUAL-01`..`QUAL-03`, `WR-*`, `IN-*`), that ID
is cited in the text so the older artifact stays findable rather than renumbered.

## v0.4.0 Requirements

### External Verification

The three highest-value carried items are one failure mode this project has now
been taught five times: an internal check standing in for an external one. All
three are live-testable here — genuine unpatched stock VICE is at
`/usr/bin/x64sc`, with the fork shadowing it earlier on `PATH`.

- [ ] **EXTV-01**: The three capturable `VERIF-02` binmon wire fixtures are re-recorded from a real VICE binary, and no sidecar in the fixture set still declares itself synthetic while being relied on as ground truth
- [ ] **EXTV-02**: The `--help` backend discriminator (`BACK-01`/`BACK-04`) is confirmed against both a real stock `x64sc` and a real fork `x64sc`, with both transcripts committed as evidence
- [ ] **EXTV-03**: Each of the four Phase 3 behavioural/spelling wire details written spec-driven and never exercised is run against a real binary, and any detail the binary contradicts is corrected at its source rather than noted

### Audit Integrity

The instrument already exists and nothing forces anyone to read it — which is how
Phase 08's `WR-04`..`WR-12` and Phase 09's `IN-01`..`IN-03` stayed invisible until
the completeness guard was built, and how `4f048bb` closed with that guard already
red.

- [x] **GATE-01**: A milestone audit cannot record `status: passed` while any of the four `docs-*.test.ts` guards is red — the precondition is mechanically enforced, not documented
- [ ] **GATE-02**: Every open code-review finding across all phases is dispositioned, including Phase 08's `WR-04`..`WR-12`, Phase 09's `IN-01`..`IN-03`, `WR-13`'s second hardcoded capability-refusal string, and `02-REVIEW.md`'s `IN-05` — and `docs-review-disposition.test.ts` runs green from a clean checkout

### Backend Decision

- [ ] **FORK-01**: The fork-backend question is answered by a dated decision in PROJECT.md → Key Decisions that names the criteria which would reverse it, including the upstream `KEYBOARD_MATRIX_SET` coupling — not retained by default for a third close
- [ ] **FORK-02**: Whichever way `FORK-01` goes, a user hitting any of the three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) is given a route they can actually follow

### Debt Disposition

- [ ] **DEBT-01**: Every item in `.planning/todos/pending/` is fixed, dispositioned `wont-fix` with recorded rationale, or explicitly promoted with a named owner — none carried silently into v0.5.0
- [ ] **DEBT-02**: The undocumented-behaviour todos are closed by documenting the behaviour where a user would actually look for it — the `Drive8Type` prerequisite, the project-paths git-marker requirement, the `releases.json` schema, `vice_ping`'s misleading `resolvedBinaryPath` under the broker pool, and the refuted warp-over-`resource_set` claim
- [ ] **DEBT-03**: Phase 03's three pending UAT scenarios are executed against real fixtures and a running program, and recorded pass or fail with evidence rather than left partial
- [ ] **DEBT-04**: The deferred-items ledger at the v0.4.0 close is still derived and guarded, and its count is lower than the 19 items inherited

### Project Identity

- [ ] **CORE-01**: PROJECT.md's Core Value either states what v0.3.0 proved — that what a session learns outlives it — or records a dated confirmation that it should not, with the evidence weighed either way

### Packaging and Repo Shape

- [ ] **PKG-01**: The plugin payload lives under `src/` with `.mcp.json` merged, and both published tarballs still contain exactly the right files (`scripts/check-npm-packages.mjs` green, no `node_modules/`, no tests, no fixtures leaked, skills present)
- [ ] **PKG-02**: `acme.mjs`, `driver.mjs` and `derive.mjs` have tests (`QUAL-01`)
- [ ] **PKG-03**: Orphaned planning references in source comments are removed or repointed (`QUAL-02`), guarded against reintroduction
- [ ] **PKG-04**: The emulator control-plane network exposure (`QUAL-03`) is either narrowed or recorded as accepted with rationale

## Future Requirements

Acknowledged, not in this roadmap.

### Upstream Contributions

- **UP-01**: A `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`) — closes stock's hardest loss for everyone, and would satisfy one of `FORK-01`'s reversal criteria
- **UP-02**: regenerator2000's `--mcp-port` / `--mcp-bind` (~5 lines) — unblocks two projects at once and a host-side TUI, currently a *stated* limit in this project's install documentation precisely because it cannot be fixed downstream

### Promoted by DEBT-01

- Whatever `DEBT-01` promotes rather than closes lands here by construction, with its rationale already written.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Landing `UP-01` / `UP-02` upstream | Pull requests against projects this repo does not own. Both are worth doing and neither is a deliverable here. Already recorded in PROJECT.md → Out of Scope; v0.4.0 leaves them there deliberately. |
| Any new tool on either backend | This milestone adds no capability. The measured test from v0.2.0 and v0.3.0 still stands: a tool without a shipped-skill caller is surplus, not a gap. |
| Removing the fork backend without a recorded decision | `FORK-01` is satisfied by a *decision*, either way. Deleting it silently would repeat the exact failure the requirement exists to stop. |
| Restating Core Value as a bookkeeping edit | `CORE-01` requires the evidence to be weighed. An edit made while opening the milestone would have been the third silent carry. |
| Re-litigating the 21 requirements cut in v0.2.0 / v0.3.0 | They sit in the milestone archives marked `CUT` with rationale. Restoring one is a scope decision for a future milestone, not debt. |
| `.vsf` as a regenerator2000 bootstrap input | Covered by `DEBT-01` as a disposition, not as a build. D-34 stands unless a consumer has `.vsf` captures and cannot re-capture as `.raw`. |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTV-01 | 13 | Pending |
| EXTV-02 | 13 | Pending |
| EXTV-03 | 13 | Pending |
| GATE-01 | 12 | Complete |
| GATE-02 | 15 | Pending |
| FORK-01 | 14 | Pending |
| FORK-02 | 14 | Pending |
| DEBT-01 | 15 | Pending |
| DEBT-02 | 15 | Pending |
| DEBT-03 | 15 | Pending |
| DEBT-04 | 17 | Pending |
| CORE-01 | 17 | Pending |
| PKG-01 | 16 | Pending |
| PKG-02 | 16 | Pending |
| PKG-03 | 16 | Pending |
| PKG-04 | 16 | Pending |

**Coverage:**
- v0.4.0 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓ (roadmap created 2026-08-21, Phases 12-17)

---
*Requirements defined: 2026-08-21 at the v0.4.0 milestone open*
*Phase numbering continues from 11.1 — this milestone starts at Phase 12.*
