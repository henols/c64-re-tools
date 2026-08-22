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
- [x] **GATE-02**: Every open code-review finding across all phases is dispositioned, including Phase 08's `WR-04`..`WR-12`, Phase 09's `IN-01`..`IN-03`, `WR-13`'s second hardcoded capability-refusal string, and `02-REVIEW.md`'s `IN-05` — and `docs-review-disposition.test.ts` runs green from a clean checkout

  > **Closure note (Phase 15).** The guard's own parser was widened in-phase before anything
  > else could be dispositioned against it (plan 15-01, the phase's tracer): it went from
  > matching only level-3, colon-terminated finding headings to any heading level 2-6, and
  > discovered **150 findings** where it had previously seen only **119**. The two
  > previously-invisible heading shapes were `03-REVIEW.md`'s level-4 (`####`) findings (14 of
  > them) and `14-REVIEW.md`'s level-3-no-colon `IN-01`; both are now pinned by a
  > fixture-driven regression test so a fifth heading shape fails loudly rather than silently
  > vanishing the way these two did. The guard runs green from a clean checkout:
  > `docs-review-disposition.test.ts` (7/7 pass, 150 findings, 0 undispositioned), re-confirmed
  > at this closure. **No finding was disposed `superseded` in this phase's own work** —
  > every finding closed by plans 15-01 through 15-12 was confirmed genuinely still open (or,
  > for `WR-05`, already fixed at a cited prior commit) by direct re-verification against
  > current source before being fixed or dispositioned; plan 15-01 itself corrected two of the
  > phase's own initial verification claims (`WR-08`, `IN-03`) from a stated `MOOT`/
  > `SUPERSEDED` back to `STILL OPEN` after direct source inspection found both claims false.
  > Named findings and their disposition:
  > Phase 08's `WR-04`..`WR-13` (ten findings, not nine — `WR-13` is the tenth, named
  > separately by the ROADMAP) all fixed at source across plans 15-02/15-03, transcribed with
  > resolvable commits in `.planning/todos/completed/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md`;
  > Phase 09's `IN-01`..`IN-03` closed `wont-fix` on evidence-immutability grounds (plan
  > 15-05); `02-REVIEW.md`'s `IN-05` fixed at source (plan 15-05, commit `9849224`);
  > `13-REVIEW.md`'s four findings dispositioned (plan 15-05: `WR-01` already fixed and pinned,
  > `WR-02`/`IN-01` deferred with named reopen triggers, `IN-02` promoted — see `### Promoted
  > by DEBT-01` below); `03-REVIEW.md`'s eight newly-surfaced findings (found by 15-01's own
  > widening) all fixed (plan 15-04).

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

- [x] **DEBT-01**: Every item in `.planning/todos/pending/` is fixed, dispositioned `wont-fix` with recorded rationale, or explicitly promoted with a named owner — none carried silently into v0.5.0

  > **Closure note (Phase 15, plan 15-12).** The pending count moved from **21** (as of plan
  > 15-01, after the guard-widening exposed nine previously-invisible findings) to **2** at
  > this closure — 19 todos closed across plans 15-04 through 15-12. This is the Phase-15
  > count, not the milestone-final one: Phase 17 measures `DEBT-04` after Phase 16 discharges
  > the payload-relocation todo (`PKG-01`), the last item this milestone's own work still
  > removes. Every promotion carries a named `Owner:` clause under `### Promoted by DEBT-01`
  > below. `wont-fix` dispositions (rationale quoted in full in each todo's own `## Resolution`):
  > Phase 09's `IN-01`..`IN-03` (evidence-immutability — the harnesses' committed transcripts
  > back the milestone's own `degrade`/`R4` verdict); the broker-tests-stall todo (they depend
  > on manual host setup — a real broker topology, emulator and display — so they cannot be
  > driven unattended); the `.vsf`-as-bootstrap-input todo (quoting `REQUIREMENTS.md`'s own
  > pre-existing Out of Scope decision verbatim); the `tools-manifest.json` staleness todo
  > (inverted — `vice_snapshot_list`'s absence is D-16's deliberate deletion, not staleness).
  > Every other closed item was fixed at source with a resolvable commit (see each todo's own
  > `## Resolution` in `.planning/todos/completed/`). The two todos still pending are both
  > promoted with a named owner, not carried silently: `2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json`
  > → `PKG-01` (Phase 16), `2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments`
  > → `PKG-03` (Phase 16) — both todos already carried `resolves_phase: 16` in their own
  > frontmatter, confirmed against Phase 16's own goal text (which names both `PKG-01` and
  > `PKG-03` by exactly these descriptions) before promoting.

- [x] **DEBT-02**: The undocumented-behaviour todos are closed by documenting the behaviour where a user would actually look for it — the `Drive8Type` prerequisite, the project-paths git-marker requirement, the `releases.json` schema, `vice_ping`'s misleading `resolvedBinaryPath` under the broker pool, and the refuted warp-over-`resource_set` claim

  > **Closure note (Phase 15).** All five behaviours documented at their point of use, by file
  > and heading: (1) the `Drive8Type` prerequisite — `.claude/skills/c64-ram-capture/SKILL.md`'s
  > `## Boot a disk` procedure closing note (plan 15-06); (2) the project-paths git-marker
  > requirement — a prerequisite paragraph before `## The order` plus a Troubleshooting row
  > (plan 15-06); (3) the `releases.json` schema — a new `## Release registry shape` section
  > before `## References`, plus a copyable `RELEASES.json.example` shipped in the skill's own
  > directory (plan 15-06); (4) `vice_ping`'s `resolvedBinaryPath` — a module-scope comment at
  > `vice-proxy.ts`'s `ACTIVE_BACKEND` resolution, plus a new additive `resolvedBinaryPathScope`
  > sibling field in the response itself, pinned by `vice-proxy-ping.test.ts` (plan 15-09); (5)
  > the refuted warp-over-`resource_set` claim — `GAINS-PROTOCOL.md`'s warp section corrected
  > to the measured 2026-08-20 stock-3.10 error codes, plus the `InitialWarpMode`
  > silent-success trap and tool-behaviour decision (plan 15-09). **The warp item's caveat
  > landed in two project-owned files** (`docs/stock-vice-parity.md`'s licensed-divergence
  > register and `capability-registry.ts`'s existing `reason` field), not in the *generated*
  > `docs/tool-support.md`/`tools-manifest.json` directly — `docs/tool-support.md` was
  > regenerated from the edited `reason` field (so it does carry the caveat, with a diff
  > limited to the one changed note cell) but `tools-manifest.json` was deliberately left
  > untouched, since it is generated from the fork binary's own compiled schema and this is a
  > text/documentation caveat, not a schema change. Placement is a judgment call
  > (`15-VALIDATION.md` independently records DEBT-02 as manual-only for this reason); Task 3
  > of plans 15-06 and 15-09 each record a first-time-reader walk confirming the citation, not
  > an automated assertion that a reader would stop there.

- [x] **DEBT-03**: Phase 03's three pending UAT scenarios are executed against real fixtures and a running program, and recorded pass or fail with evidence rather than left partial

  > **Closure note (Phase 15).** All three scenarios executed live against genuine
  > `/usr/bin/x64sc` and recorded, per-scenario: **scenario 1** (`vice_autostart`/
  > `vice_disk_attach`/`vice_snapshot_load`) — **pass**, decided by byte comparison (plan
  > 15-08). **Scenario 2** (`vice_keyboard_petscii`/`vice_joystick_set` against a proven-running
  > program) — **partial**: the keyboard half is a clean, deterministic pass; the joystick half
  > is an honest negative result — all five single-bit `JOYPORT_SET` rounds plus fire showed
  > zero delta at both CIA1 port bytes, reproducing Phase 13's `A3` (`INCONCLUSIVE`) finding
  > under a strictly stronger precondition (an independently-proven-running program, which
  > rules out A3's "running-program precondition" candidate explanation while leaving the
  > other two open) (plan 15-08). No fix was promoted for the joystick half specifically — `A3`
  > was already a standing, disclosed `[ASSUMED]` limitation before this phase (pinned by
  > `assumption-label-discipline.test.ts`), and this phase's live evidence narrows, rather than
  > resolves, which of A3's remaining two candidate explanations applies; the transcript is
  > recorded in `15-UAT-EVIDENCE.md` for whichever future probe re-attempts A3. **Scenario 3**
  > (the hot non-stopping-checkpoint auto-disable guard under sustained 20+/sec hit pressure)
  > — **pass**: a real `stop:false` checkpoint armed on the KERNAL's default IRQ vector
  > (`$EA31`) was driven to `hitsPerSecond: 21`, the D-11 guard's auto-disable fired and was
  > independently confirmed wire-side, and the emulator kept progressing afterward — CONFIRMED
  > for the rates and host tested (plan 15-10). `03-HUMAN-UAT.md` carries zero `result:
  > [pending]` rows; its own `status:` field stays `partial` (not softened to force an overall
  > pass) because scenario 2's joystick half is a genuine, honestly-recorded negative result —
  > DEBT-03's criterion is "recorded pass or fail with evidence", which all three scenarios
  > satisfy, not "passed".

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

- **`vice_disk_attach`'s contract-redesign question.** Phase 13's A5 probe (`13-PROBE-RESULTS.md`)
  found `vice_disk_attach` performs a full machine reset and load, contradicting its own
  advertised "attach without loading or running" approximation — corrected in the returned
  string and `docs/stock-vice-parity.md`'s D-14 bullet by plan 15-11, but the deeper question
  (should the tool be restructured, given how little it differs from `vice_autostart`?) was
  deliberately not answered — a feature/contract redesign is out of a disposition phase's
  remit (the same D-13-04 escape hatch `EXTV-03`'s closure note cites). Owner: whichever future
  milestone next redesigns `vice_disk_attach`'s tool contract — no v0.4.0 phase (12-17)
  implements it; this phase only surfaced that it needs a designed answer, not a silent one.
- **`code-review.md`'s file-list scoping omission.** `13-REVIEW.md`'s `IN-02` found that
  matched `.txt`/`.json` evidence-fixture pairs are not scoped as a unit by
  `.claude/gsd-core/workflows/code-review.md`'s `files:` derivation — a defect in the GSD
  toolkit's own workflow definition, not in anything this project's phases built (plan 15-05
  confirmed this directly against the workflow file). Owner: the GSD toolkit itself — file or
  fix upstream in the GSD core repository/workflow definition, not in this project's own
  source tree, where there is nothing to change.
- **Measuring `InitialWarpMode`'s actual runtime effect.** The 2026-08-20 warp probe confirmed
  a runtime `RESOURCE_SET WarpMode` succeeds and reads back as set on stock, but per
  `vsync.c:207-209` only the launch-time value is ever consulted — whether a runtime set has
  any measurable effect on emulation speed (item 5 of the original warp todo's five-item
  Solution list) was left unmeasured by design (plan 15-09). Owner: whichever future plan next
  needs stock warp/speed control for a real capability — no v0.4.0 phase needs it; the
  documentation fix (marking `vice_machine_config_set`'s `WarpMode` fork-only) already closes
  the SKILL-01 landmine this item's parent todo existed to fix.
- **Deriving `cpuhistory-get*` fixtures' `capturedFrom` kind automatically.** Plan 15-07 fixed
  the two mislabelled sidecars' `capturedFrom` field by hand (`stock` → `fork`, re-measured
  live) but did not implement deriving that field from `resolvedBackend()` automatically,
  since the change would touch `probe-binmon.mjs`'s capture path — a file plan 15-05 already
  marked evidence-immutable for `13-REVIEW.md`'s `WR-02` (splitting it would rewrite the file
  that produced this milestone's own committed probe transcripts). Owner: whichever future
  plan next edits `probe-binmon.mjs`'s capture path for an unrelated reason — not this
  milestone, and not a standalone justification to touch that file on its own.

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
| GATE-02 | 15 | Complete |
| FORK-01 | 14 | Complete |
| FORK-02 | 14 | Complete |
| DEBT-01 | 15 | Complete |
| DEBT-02 | 15 | Complete |
| DEBT-03 | 15 | Complete |
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
