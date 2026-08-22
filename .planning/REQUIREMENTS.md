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

- [x] **EXTV-01**: The three capturable `VERIF-02` binmon wire fixtures are re-recorded from a real VICE binary, and no sidecar in the fixture set still declares itself synthetic while being relied on as ground truth
- [x] **EXTV-02**: The `--help` backend discriminator (`BACK-01`/`BACK-04`) is confirmed against both a real stock `x64sc` and a real fork `x64sc`, with both transcripts committed as evidence
- [x] **EXTV-03**: Each of the four Phase 3 behavioural/spelling wire details written spec-driven and never exercised is run against a real binary, and any detail the binary contradicts is corrected at its source rather than noted

  > **Closure note (Phase 13, D-13-04 escape hatch).** "Corrected at its source" is satisfied
  > by a *scoped contract todo* when the contradiction is an advertised **tool-contract**
  > defect rather than a wire-encoding bug. A5 (`AUTOSTART` with `runAfter=false`) came back
  > CONTRADICTED — it performs a full machine reset and loads a program regardless of
  > `fileIndex` — which refutes `vice_disk_attach`'s advertised D-14 "attach without loading
  > or running" promise. That is a feature/contract redesign, and D-13-04 (decided in
  > `13-CONTEXT.md` before any plan ran) deliberately forbids a verification phase from
  > absorbing one. A5's fix is therefore
  > `.planning/todos/pending/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md`
  > (priority: high), and A5's `[ASSUMED]` label deliberately **stays on** until that todo
  > closes. A1 and A2 were CONFIRMED and corrected at source; A3 was INCONCLUSIVE and keeps
  > its label; A4 was deliberately not probed (non-stopping checkpoints stall the CPU loop,
  > D-13-05) and remains the sole open item in
  > `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`. Evidence:
  > `.planning/phases/13-external-verification/13-PROBE-RESULTS.md`.

### Audit Integrity

The instrument already exists and nothing forces anyone to read it — which is how
Phase 08's `WR-04`..`WR-12` and Phase 09's `IN-01`..`IN-03` stayed invisible until
the completeness guard was built, and how `4f048bb` closed with that guard already
red.

- [x] **GATE-01**: A milestone audit cannot record `status: passed` while any of the four `docs-*.test.ts` guards is red — the precondition is mechanically enforced, not documented
- [ ] **GATE-02**: Every open code-review finding across all phases is dispositioned, including Phase 08's `WR-04`..`WR-12`, Phase 09's `IN-01`..`IN-03`, `WR-13`'s second hardcoded capability-refusal string, and `02-REVIEW.md`'s `IN-05` — and `docs-review-disposition.test.ts` runs green from a clean checkout

### Backend Decision

- [x] **FORK-01**: The fork-backend question is answered by a dated decision in PROJECT.md → Key Decisions that names the criteria which would reverse it, including the upstream `KEYBOARD_MATRIX_SET` coupling — not retained by default for a third close
- [x] **FORK-02**: Whichever way `FORK-01` goes, a user hitting any of the three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) is given a route they can actually follow

  > **Closure note (Phase 14, plan 14-05).** `FORK-01` decided `retain` —
  > by a **human**, at plan 14-01's `gate="blocking-human"` checkpoint, after
  > explicit escalation (not inferred, not auto-approved). Recorded in
  > `.planning/PROJECT.md` → Key Decisions, dated 2026-08-22, naming the
  > upstream `KEYBOARD_MATRIX_SET` opcode landing as the reversal criterion,
  > and pinned by `.claude/mcp/vice/docs-fork-decision.test.ts`. `FORK-02`'s
  > "a route they can actually follow" was satisfied by **the plan's own
  > default reading** — sub-question B was NOT overridden at the checkpoint —
  > meaning an honest, complete statement of permanent loss (no client-side
  > substitute for SID read-back or RESTORE/NMI) is sufficient; no
  > replacement-capability requirement was added. Plan 14-02 verified all 17
  > point-of-use mention sites `holds-as-is` with zero rewrite
  > (`14-ROUTE-EVIDENCE.md`); plan 14-03 exercised the fork's own
  > `-mcpserver` HTTP transport live for the first time in this repository
  > (`14-CRITERION3-EVIDENCE.md`, 6/6 passing, including `vice_sid_get_state`
  > end to end). Since the branch is `retain`, ROADMAP criterion 3's "remove"
  > clause is not in play — no unmet part to record.

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

### Fork Backend Follow-on (FORK-01, decided `retain`, Phase 14 plan 14-05)

Deliberately excluded from Phase 14's own scope (research Pitfall 4: Phase
14's requirements are the decision and the routes, not reimplement-or-drop
24 tools). Each item below is owned follow-on work, not an unstated gap,
tied to the same reversal condition (`UP-01`) that would reopen `FORK-01`:

- **The 24-fork-only-tool disposition.** If `FORK-01` is ever revisited and
  decided away from `retain`, each of the 24 fork-only tools enumerated in
  `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`
  (chip-state read/write, matrix keyboard, display, sprites/memory/checkpoints,
  disk/machine-config) needs a per-tool disposition — drop, reimplement on
  the binary monitor, or record as an accepted permanent loss. Owner: the
  milestone that next opens `FORK-01`.
- **Breaking-tool-surface release handling.** `@henols/vice-mcp` advertises
  62 named tools today, and every merge to `main` auto-publishes a patch
  version unless the commit subject carries `[skip release]`. Any future
  removal of fork-only tools is a semver-major, breaking change and needs a
  deliberate major-version release, not an ordinary merge. Owner: whoever
  executes a future non-`retain` `FORK-01` decision.
- **`KEYBOARD_MATRIX_SET` reversal-trigger tracking.** `FORK-01`'s reversal
  criterion (`UP-01` landing in a released VICE, then reaching this
  project's documented primary install path a release cycle later) has no
  version probe — an opcode with zero wire presence today cannot be
  mechanically detected. It is tracked manually. Owner: whoever next opens
  a milestone that revisits backend decisions; check VICE's release notes
  and `apt`/package-manager version tables (see README.md → "Which VICE you
  get, per package manager") before assuming the trigger has not fired.

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
| A version probe for `KEYBOARD_MATRIX_SET` (a hypothetical future VICE binary-monitor opcode, `UP-01`) | The opcode has zero wire presence as of VICE 3.10 — nothing to probe for yet. Building a probe for a capability that does not exist would be speculative engineering against an unlanded upstream change; `FORK-01`'s reversal trigger is tracked manually instead (see Future Requirements → Fork Backend Follow-on). |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTV-01 | 13 | Complete |
| EXTV-02 | 13 | Complete |
| EXTV-03 | 13 | Complete |
| GATE-01 | 12 | Complete |
| GATE-02 | 15 | Pending |
| FORK-01 | 14 | Complete |
| FORK-02 | 14 | Complete |
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
