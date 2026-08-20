---
gsd_state_version: 1.0
milestone: v0.3.0
milestone_name: regenerator2000 static-analysis backend
status: verifying
last_updated: "2026-08-20T09:50:15.559Z"
last_activity: 2026-08-20
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 8
  completed_plans: 8
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-19 after v0.2.0 milestone close)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
**Shipped:** v0.2.0 Switchable stock-VICE backend — 2026-08-19 (9 phases, 87
plans, 51/51 in-scope requirements). Stock upstream `x64sc` is a first-class,
project-selectable backend with 38 tools; the fork keeps its 62 unchanged.
**Current focus:** Phase 09 — the-assumption-probe-go-no-go
ROADMAP.md defines **three phases — 9, 10, 11** (numbering continued from v0.2.0's
1-8 + 8.1/8.2), with all 12 in-scope `R2000-*` requirements mapped exactly once.
Phase 9 is a standalone **go/no-go gate**: `R2000-16`'s five-assumption probe
against a real regenerator2000 build, whose recorded verdict decides whether the
milestone proceeds as scoped, degrades, or is reconsidered. No Phase 10/11 plan is
written before it closes. Also open and arguably first: publishing v0.2.0, which
is 386 commits ahead of `origin/main` at tag `v0.1.10`.

## Current Position

Phase: 09 (the-assumption-probe-go-no-go) — COMPLETE (8/8 plans executed)
Plan: 8 of 8
Status: Phase complete — ready for verification. Verdict `degrade` (rule `R4`)
recorded at `docs/phase9-regenerator2000-probe-findings.md`. Next step: Phase 10
as scoped, with the two named scope amendments (`.vsf` machine-type trust;
explicit `use_illegal_opcodes` setting) applied at their targets — not a
documented manual bootstrap step, since criteria 2a/2b both passed cleanly. No
Phase 10 or Phase 11 plan is written before that findings document is read, per
`R2000-16`'s own wording.
Last activity: 2026-08-20

## Performance Metrics

**Velocity:**

- Total plans completed: 87
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 10 | - | - |
| 03 | 18 | - | - |
| 04 | 7 | - | - |
| 05 | 13 | - | - |
| 07 | 18 | - | - |
| 08 | 6 | - | - |
| 08.1 | 5 | - | - |
| 08.2 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 03 P17 | N/A | 2 tasks | 0 files |
| Phase 03-direct-tools P18 | 5m | 1 tasks | 0 files |
| Phase 08.1 P01 | 15min | 3 tasks | 3 files |
| Phase 08.1 P03 | 25m | 3 tasks | 1 files |
| Phase 08.1 P02 | 22min | 3 tasks | 3 files |
| Phase 08.1 P04 | 90min | 2 tasks | 5 files |
| Phase 08.1 P05 | 45min | 2 tasks | 3 files |
| Phase 09 P01 | 30min | 3 tasks | 5 files |
| Phase 09 P08 | 10m | 2 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Close v0.2.0 audit items: UAT walkthrough + planning-doc drift (URGENT)
- Phase 8.2 inserted after Phase 8.1: Close v0.2.0 blockers: stock drive-config defect, red test gate, walkthrough re-run (URGENT)
- v0.3.0 opened as Phases 9-11, continuing v0.2.0's numbering rather than resetting to 1.
- v0.3.0 re-split from two phases to three: `R2000-16`'s assumption probe was
  promoted out of Phase 9's body into a standalone go/no-go phase. Its failure mode
  is *reconsider the milestone*, not *replan the phase* — if regenerator2000 cannot
  be driven without a human, the annotation store is unreachable from a skill and
  the thesis is in question. A note inside a larger phase makes that gate skippable;
  a phase boundary makes it structural. Precedent: v0.2.0 Phase 8.1, where running
  the one unwitnessed claim falsified it.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: BACK-02 (fork backend unchanged) is a success criterion in Phase 2
  only, plus a standing per-phase regression gate — not a criterion repeated per
  phase. See ROADMAP.md "Standing Constraints".

- Roadmap: DERIV-07's derived-tool interception seam is built once in Phase 4
  alongside its first and largest consumer (the disassembler); Phase 5's
  screenshots and derivations and Phase 6's gains all route through it.

- Roadmap: the disassembler library is protocol-independent and may be built in
  parallel with Phase 2/3 — the largest parallelism win available.

- Milestone: all three stock-only gain groups in scope (not parity-first).
- Milestone: backend selected project-level, one per MCP server process; parity
  verification therefore requires two server processes.

- [Phase ?]: Route authorised: pr-branch — push a branch and open a PR against main; no push/branch/tag/publish performed by 03-17 — milestone v0.2.0 is only 3 of 8 phases done; publishing now would ship a partial stock backend to real users
- [Phase 03-direct-tools]: CI validated via pr-branch route: PR #9 (ci/phase-03-validation -> main), GitHub Actions build job concluded success against sha f040d79efdfe02fc5a22a77589052c138f5cdc20; no push to main, no tag, no release, no npm publish; PR left open unmerged
- [Phase 08.1]: Checklist emits one composite PASS/FAIL line per D-item (not per sub-condition) so the RED baseline shows zero PASS lines despite already-true guard conditions
- [Phase 08.1]: 08.1-03: FINDING-A1 corrected/widened -- the acme-build scaffold's missing cbm/c64/* library gap also breaks CI's own apt-provisioned environment, verified via apt-get download + dpkg-deb -x
- [Phase 08.1]: 08.1-03: capture target built from a new library-free ACME source (hand-rolled hardware constants) per human decision, instead of installing an ACME stdlib or hand-editing acme-build/template.a
- [Phase 08.1]: 08.1-03: scratch project wired via route A (local installer) + hand-edited .mcp.json, not claude plugin marketplace add/install, to avoid writing into machine-global ~/.claude/plugins/ state shared with the live orchestrating session
- [Phase 08.1]: STATE.md frontmatter left untouched (already correct: 7/9 phases, 78%); only STATE.md's/ROADMAP.md's bodies were reconciled with it
- [Phase 08.1]: Criterion 2 verified rather than re-authored: 08-VALIDATION.md already read status: audited / nyquist_compliant: true from prior commit 4306338; evidence recorded, file left unmodified
- [Phase 08.1]: Recorded criterion-1 UAT walkthrough result honestly as failed — Genuine stock x64sc boots with Drive8Type=0 by default; no MCP tool on the stock surface can set it, so the disk-based capture cannot complete; no workaround was applied to force a pass (FINDING-C1 in 08.1-WALKTHROUGH-EVIDENCE.md).
- [Phase 08.1]: Root-caused the recurring STATE.md Progress-line drift to two disagreeing GSD SDK formulas (uncapped plan-file ratio vs phase-fraction-capped computeProgressPercent), then caught its own initial 78% fix going stale mid-execution when a state.* frontmatter auto-resync mechanism correctly advanced ground truth to 8/9 phases (89%); corrected the body line to 89%, synced ROADMAP.md via roadmap.update-plan-progress, and replaced D-5's brittle bare-literal checklist assertion with a body-vs-frontmatter self-consistency invariant.
- [Phase 08.1]: Carried the confirmed Drive8Type=0 open product defect (plan 08.1-04's live-proven finding, confirmed fix -drive8type 1541 at launch, not yet applied) forward into STATE.md's Deferred Items/Blockers and ROADMAP.md's Phase 8.1 notes as explicit open backlog, rather than leaving it recoverable only from a dated decision-log line.
- [Phase quick-260819-vie]: One release-assets seam (scripts/release-assets.sh) now owns stamp/zip/attach; both release and release-on-merge CI jobs call it with the version as an explicit argument — v0.2.0 shipped with zero release assets because the merge path's GITHUB_TOKEN-created tag never re-triggers the tag-gated release job
- [Phase 09-01]: Human authorized cargo install regenerator2000 and tmux install at a blocking checkpoint; both performed by the human, never by this agent (its own tool-permission classifier denies cargo install outright)
- [Phase 09-01]: regenerator2000 0.9.20's real toolchain floor is rustc >=1.88 (transitive, undeclared in Cargo.toml), not edition 2024's 1.85; --locked does not work around it; rustup update stable (1.85.1->1.97.1) was a human-authorized host change
- [Phase 09]: Go/no-go verdict recorded: **`degrade`**, rule **`R4`** fired (triggering input: `c3_4_vsf_load: partial`), against installed **regenerator2000 0.9.20**. Full evidence, all seven criteria and the reproduced decision rule live in one place: `docs/phase9-regenerator2000-probe-findings.md` (frontmatter `verdict`/`verdict_rule_applied`/`criteria`) — read there, not restated here.
- [Phase 09-08]: Ran sequentially on main with no worktree isolation, per this plan's own worktree: false frontmatter -- its deliverable IS STATE.md/ROADMAP.md content, which worktree mode strips from executor commits
- [Phase 09-08]: Added a ROADMAP Phase 11 Notes pointer to the findings document even though the verdict produced no scope amendment there, because Phase 11's own pre-existing Notes anticipated a criterion-3(3) format-mismatch contingency that needed an explicit answer (it did not fire)

### Pending Todos

16 pending — see `.planning/todos/pending/` (`/gsd-capture --list`).

Newest: `2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` — retire the fork
backend entirely (HTTP `/mcp` seam, `VICE_BACKEND` selection, two-manifest split,
per-backend skill routing), leaving stock as the only backend. Not a pure deletion:
24 `vice_*` tools are fork-only (SID/VIC-II/CIA state, matrix keyboard, screenshots,
checkpoint groups), so each needs a drop / reimplement / accept-loss decision, and
the 62-tool published contract makes it semver-major.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260817-n6p | Fix WR-01 — bound `decode()`'s `startAddress` to `0..0xffff` in `disasm-decoder.ts` | 2026-08-17 | e19d8eb |  | [260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i](./quick/260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i/) |
| 260818-nh5 | Close Phase 07 UAT gap: fix stale evidence-key assertion in `stock-live-triage.test.ts`, restore the restarted live proof, and close the manual-only gate hole | 2026-08-18 | acc9933 (+84cca54, 9831fa8) |  | [260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc](./quick/260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc/) |
| 260818-obc | Live-prove the broker-mediated `monitor_held_elsewhere` verdict and the broker-supervised `restarted` respawn against a real host broker daemon and genuine stock VICE (both 3.9/3.10); closes TIME-04 | 2026-08-18 | 662dfd4, 0b236f1, b3965eb, d2a9235 |  | [260818-obc-live-prove-the-broker-mediated-monitor-h](./quick/260818-obc-live-prove-the-broker-mediated-monitor-h/) |
| 260819-rop | Fix milestone-audit D4-2 and NEW-1: stop ROADMAP.md asserting Phase 7 owns disk detach, and correct the D-07 "same argument shape" claim to backward-compatible at all six live sites plus a structural test pinning it | 2026-08-19 | f574e21, 79af9a7, 3344809 |  | [260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone](./quick/260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone/) |
| 260819-tsz | Replace six hand-maintained version strings with one `VERSION` template (`0.2.-`, `-` = auto-managed slot) plus a resolver seam, wired into CI; a hand minor/major bump now publishes X.Y.0 instead of continuing the old patch count | 2026-08-19 | 38a56ac..811746b (16 commits) | passed (verifier returned `partial` on a stale-README gap; gap closed in 7665025, and 8/8 code-review findings fixed) | [260819-tsz-single-version-template-plus-resolver-sc](./quick/260819-tsz-single-version-template-plus-resolver-sc/) |
| 260819-vie | Fix the release-asset gap: extract stamp+zip+upload into one seam (`scripts/release-assets.sh`) called by both release paths, since `release-on-merge`'s GITHUB_TOKEN tag cannot re-trigger the tag-gated `release` job; v0.2.0's missing plugin zip attached retroactively | 2026-08-19 | 4867535..ee296c0 (4 commits, all `[skip release]`) | passed (asset verified by download: zip + sha256, `plugin.json`/`marketplace.json` all `0.2.0`) | [260819-vie-extract-release-stamp-zip-upload-into-on](./quick/260819-vie-extract-release-stamp-zip-upload-into-on/) |

### Blockers/Concerns

- **Phase 1 external prerequisite:** VERIF-01 needs a real stock VICE build and a
  display on the *host*; this repo's container has neither. Confirm availability
  before planning Phase 1.

- **`docs/phase0-binmon-findings.md` is normative (ingest W2) and currently
  wrong in four places.** Until Phase 1 lands, do not derive protocol design
  from it — in particular, a condition written on `LIN` instead of `RL` fails at
  runtime with error `0x8f` and gives no diagnostic over the socket.

- **Requirement count discrepancy resolved:** REQUIREMENTS.md said 63; the file
  contains 67 items. Corrected to 67 in the Coverage block.

- ~~**Open coverage gap:** ... Decide: add `SKILL-01` mapped to Phase 8, or defer
  explicitly.~~ **Decided (recorded 2026-08-18).** `SKILL-01` exists, is written up at
  `REQUIREMENTS.md:110`, and is mapped to Phase 8 in both `REQUIREMENTS.md:227` and
  ROADMAP.md's Phase 8 Requirements list. The decision had already been taken; only
  this note lagged.

- **`CPUHISTORY_GET` needs VICE ≥ 3.10**; Debian and all current Ubuntu ship 3.9,
  so the milestone's headline gain is unavailable on the most common `apt`
  install path. Graceful degradation is required, not optional.

- Phase 08.1 plan 03 Task 2 blocked: acme-build's own template.a cannot assemble on this machine -- the ACME binary at ~/.local/bin/acme has no accompanying cbm/c64/*.a library, apt has a candidate (acme 1:0.97~svn20211115+ds-2) but this session has no passwordless sudo. Needs a human to run 'sudo apt-get install -y acme' (or supply an ACME library at $ACME) before the criterion-1 walkthrough's capture target can be built. See 08.1-WALKTHROUGH-SETUP.md FINDING-A1.

- **Fixed product defect (FINDING-C1, Phase 8.1 plan 04, fixed Phase 8.2):** the
  broker used to launch stock `x64sc` with `Drive8Type=0` (NONE) by default. No tool
  on the stock MCP surface (`vice_disk_attach`, `vice_autostart`) set a drive type, so
  `LOAD"*",8,1` failed `?DEVICE NOT PRESENT ERROR` and every disk-based
  `c64-ram-capture` walkthrough against genuine stock VICE failed at the load step
  -- and plan 03's live measurement found the blast radius was **all program loads**
  (a bare `.prg` autostart hit the identical wall too), not merely disk loads.
  Phase 8.2 plan 02 landed the fix (`-drive8type 1541` in `buildViceArgs()`'s stock
  branch); plan 03 proved the fixed argv reaches a real live launch; plan 04 re-ran
  the same walkthrough end to end and recorded `capture_result: pass`
  (`08.2-WALKTHROUGH-EVIDENCE.md`), flipping `08-HUMAN-UAT.md` Test 1 to
  `status: passed` (human-approved, 08.2-04 Task 3). Full original diagnosis:
  `08.1-WALKTHROUGH-EVIDENCE.md` FINDING-C1; superseded outcome recorded at
  `08-HUMAN-UAT.md` Test 1.

- **Phase 9 verdict accepted limit — `.vsf` machine-type auto-detection does not
  generalise beyond C64.** A `.vsf` produced by `vice_snapshot_save` against genuine
  stock VICE loads into regenerator2000 with the correct RAM content and start
  address, but its displayed machine type is a coincidental default, not a genuine
  read — the snapshot's raw `machine_name` (`"C64SC"`) matches none of
  `file_io.rs`'s four literal match arms. **What this breaks:** the ROADMAP's standing
  "prefer `.vsf` over `.raw`" constraint is unsupported as worded for the machine-type
  field, and Phase 10 criterion 3 (plus any future non-C64 `.vsf` extension of
  `c64-ram-capture`) must verify or explicitly set the system rather than trust
  auto-detection. See `docs/phase9-regenerator2000-probe-findings.md` § Accepted
  limits, entry 2.

- **Phase 9 verdict accepted limit — `use_illegal_opcodes` is not the keystroke-
  bootstrap default.** regenerator2000's illegal-opcode reassembly passed, but only
  under a direct-JSON-edit override; the fresh bootstrap (criterion 2b) leaves the
  project setting `false`, and auto-analysis does not flip it. **What this breaks:**
  `R2000-09`'s automated-bootstrap work and any pipeline wanting illegal-opcode-correct
  disassembly must explicitly set `settings.use_illegal_opcodes = true` in the
  generated `.regen2000proj` before exporting or verifying — it does not withhold the
  Phase 10 criterion 4 / `R2000-06` deletion decision, which was earned against real
  illegal opcodes. See `docs/phase9-regenerator2000-probe-findings.md` § Accepted
  limits, entry 1.

## Deferred Items

**13 items acknowledged and deferred at the v0.2.0 milestone close on 2026-08-19.**
The pre-close artifact audit reported these; the round-4 milestone audit had
already assessed the same set as `tech_debt` with no blockers. They were accepted
rather than resolved, and are v0.3.0's inheritance unless dispositioned sooner.

| Category | Item | Priority | Status |
|----------|------|----------|--------|
| todo | 2026-08-13-confirm-help-discriminator-against-real-vice-binaries | high | Pending — BACK-01/BACK-04's `--help` backend discriminator unconfirmed against real stock and fork binaries |
| todo | 2026-08-13-re-record-binmon-fixtures-against-real-stock-vice | high | Pending — VERIF-02's three capturable fixtures are synthetic, honestly marked in every sidecar |
| todo | 2026-08-14-probe-phase3-assumed-wire-details | high | Pending — four Phase 3 behavioural/spelling details written spec-driven, never exercised against a real binary |
| todo | 2026-08-13-reconcile-ci-test-command-with-narrowed-gate | — | Pending — CI runs bare `npm test`, not `npm run test:automated`; both verified green from the main checkout, so the divergence hides no red gate |
| todo | 2026-08-12-vice-broker-tests-stall-outside-devcontainer | low | Pending — pre-existing, user-dispositioned 2026-08-12 as "not a bug to fix" |
| todo | 2026-08-17-document-second-binmon-client-as-a-wedge-lookalike | — | Pending |
| todo | 2026-08-19-acme-build-scaffold-library-missing-on-both-provisioning-routes | — | Pending — FINDING-A1; Debian `acme` ships no `cbm/c64/*.a` standard library, CI's own environment included |
| todo | 2026-08-19-drive-type-prerequisite-undocumented-in-readme-and-skill | — | Pending |
| todo | 2026-08-19-keyboard-fallback-load-does-not-progress-within-bounded-poll | — | Pending — FINDING-E2; does not affect DIST-03, whose passing route was `vice_autostart` |
| todo | 2026-08-19-project-paths-git-marker-requirement-undocumented | — | Pending |
| todo | 2026-08-19-releases-json-schema-undocumented | — | Pending |
| todo | 2026-08-19-vice-ping-resolvedbinarypath-misleading-under-broker-pool | — | Pending |
| uat_gap | Phase 03 — `03-HUMAN-UAT.md` | — | Partial, 3 pending scenarios: `vice_autostart`/`vice_disk_attach`/`vice_snapshot_load` against real fixtures; `vice_keyboard_petscii`/`vice_joystick_set` against a running program; the hot non-stopping-checkpoint auto-disable guard under sustained 20+/sec hit pressure |

Not counted above, because they are complete on disk: the four `.planning/quick/`
tasks the audit reported as `[missing]` (`260817-n6p`, `260818-nh5`,
`260818-obc`, `260819-rop`) each carry a PLAN and a SUMMARY; the audit reads
`missing` because their SUMMARY frontmatter has no `status:` field. Likewise the
three UAT files reported as gaps that read `resolved` / `passed` / `passed`
(`03-UAT.md`, `08-HUMAN-UAT.md`, `08.1-HUMAN-UAT.md`).

Also carried, not blocking: roughly fifteen WR-class code-review findings across
five phases, enumerated per phase in
`milestones/v0.2.0-MILESTONE-AUDIT.md` → `tech_debt`. The one worth reading
first is **WR-13** — a second capability-refusal string hardcodes "the fork
backend provides this tool", false for two `stock-only-gain` names. Verified
unreachable today (all 38 manifest names have handlers), so it is dead code that
violates one-source-of-truth rather than a live defect.

### Carried forward from earlier closes

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Defect | `Drive8Type=0` default on stock broker launch blocked all program loads (`.d64` and bare `.prg` alike) via `c64-ram-capture` (FINDING-C1); fix `-drive8type 1541` at launch | **Fixed** — Phase 8.2 plans 02-04 landed the fix, proved it live, and re-ran the walkthrough to a recorded `pass` | v0.2.0 Phase 8.1 (2026-08-19), fixed in Phase 8.2 (2026-08-19) |
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | Deferred | v0.2.0 scoping |
| Quality | QUAL-02 — orphaned planning references in source comments | Deferred | v0.2.0 scoping |
| Quality | QUAL-03 — emulator control-plane network exposure | Deferred | v0.2.0 scoping |

## Session Continuity

Last session: 2026-08-20T09:50:15.545Z
Stopped at: Completed 09-08-PLAN.md: verdict discoverability closed via STATE.md decision entry and ROADMAP Phase 9/10/11 pointers (R2000-16 criterion 5); Phase 9 complete 8/8
Resume file: None

## Operator Next Steps

- Start the next milestone with `/gsd-new-milestone` — it creates a fresh
  `REQUIREMENTS.md`, which was removed at close.

- Consider publishing first: 386 commits sit unpushed ahead of `origin/main`,
  newest tag `v0.1.10`. None of v0.2.0 has reached a user.

- `R2000-16`'s assumption probe gates all of v0.3.0 and has no v0.2.0
  dependency — it can run before the milestone is opened.
