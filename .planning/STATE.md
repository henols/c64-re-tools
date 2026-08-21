---
gsd_state_version: 1.0
milestone: v0.3.0
milestone_name: regenerator2000 static-analysis backend
status: verifying
last_updated: "2026-08-21T11:10:28.325Z"
last_activity: 2026-08-21
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 36
  completed_plans: 36
  percent: 100
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
**Current focus:** Milestone complete
ROADMAP.md defines **three phases — 9, 10, 11** (numbering continued from v0.2.0's
1-8 + 8.1/8.2), with all 12 in-scope `R2000-*` requirements mapped exactly once.
Phase 9 is a standalone **go/no-go gate**: `R2000-16`'s five-assumption probe
against a real regenerator2000 build, whose recorded verdict decides whether the
milestone proceeds as scoped, degrades, or is reconsidered. No Phase 10/11 plan is
written before it closes. `v0.2.0` is tagged, pushed and published on both npm
packages, so no release work gates the milestone.

## Current Position

Phase: 11.1 -- Close v0.3.0 Audit Items (INSERTED)
Plan: 7 of 7
Status: Phase complete — ready for verification

All 12 plans executed across 7 waves and merged into main; verification
`passed` (4/4 roadmap success criteria, 5/5 requirement IDs). Post-merge gate
green at every wave; full suite 2066 pass / 0 fail, no cross-phase regressions.

What the phase delivered: the r2000 MCP client seam (11-04) and the 17 curated
`r2000_*` tools (11-05); register-bit enums generated from the memory map, with
criterion 3 byte-verified against real ACME (11-06); the symbol round trip in
code (11-08) and demonstrated live against genuine unpatched stock x64sc
(11-11); the store made canonical with the Markdown memory map a generated view
(11-10); and the recon/memory-mapping/ram-capture playbooks rewritten to emit
store entries rather than prose (11-12). Criterion 1's two-session
falsifiability proof is closed: session B answered a question sealed before it
existed and the sha256 matched (11-07, 11-09).

Security closed: `11-SECURITY.md` is `status: verified` / `threats_open: 0`
(69 threats, 66 closed at audit, the remaining 3 closed by quick task
260821-a86 -- WR-01's parent-realpath containment in `resolveStorePath()`,
T-11-NAME-INJECT's REJECT policy on both label-name entry routes, and WR-04's
Markdown-cell escaping in `renderMemoryMap()`).

Open, recorded, non-blocking: the enum double-run no-op (11-06); and the three
unregistered flags WR-02 (refusal shape), WR-03 (unbounded batch recursion) and
WR-05 (missing post-spawn `"error"` listener), which 260821-a86 deliberately
left out of scope.

Phase 10's retroactive security audit (`10-SECURITY.md`) is also now closed:
`status: verified` / `threats_open: 0` (25 threats, 24 closed at audit, the
remaining one -- WR-08, unregistered until this closure, assigned T-10-19 --
closed by quick task 260821-jd8: `parseArgs()`'s `--entry`/`--out` now refuse
a missing or flag-shaped value instead of silently swallowing it).

Last activity: 2026-08-21 - Completed quick task 260821-a86: closed Phase 11's
three open security findings (WR-01, T-11-NAME-INJECT, WR-04); then quick task
260821-jd8: closed Phase 10's last open security finding (WR-08 / T-10-19)

## Performance Metrics

**Velocity:**

- Total plans completed: 116
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
| 09 | 8 | - | - |
| 10 | 9 | - | - |
| 11 | 12 | - | - |

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
| Phase 11 P03 | 28min | 3 tasks | 10 files |
| Phase 11.1 P01 | 45min | 2 tasks | 4 files |
| Phase 11.1 P02 | 55min | 2 tasks | 7 files |
| Phase 11.1 P03 | 45m | 2 tasks | 1 files |
| Phase 11.1 P04 | 95min | 3 tasks | 5 files |
| Phase 11.1 P05 | ~2h | 3 tasks | 9 files |
| Phase 11.1 P06 | 70min | 3 tasks | 3 files |
| Phase 11.1 P07 | ~3.5h | 4 tasks | 8 files |

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

- Phase 11.1 inserted after Phase 11: Close v0.3.0 audit items: the stale .vsf pointer, the undocumented CLI verbs, and the guards that let them drift (URGENT)

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
- [Phase 11-03]: Ran sequentially on main with no worktree isolation, per this plan's own worktree: false frontmatter -- its deliverables ARE .planning/ROADMAP.md/REQUIREMENTS.md content plus two todo-file git mv moves, which worktree mode strips from executor commits
- [Phase 11-03]: Reworded ROADMAP.md's Phase-10-criterion-3 .vsf note from 'Phase 11 confirmed this (D-34)' to 'confirmed by D-34' after the literal string 'Phase 11' on a .vsf-mentioning line tripped the acceptance grep gate that checks no document still names Phase 11 as .vsf's home -- same meaning, mechanically clean
- [Phase 11.1]: D-11.1-01: both r2000-cli.ts .vsf surfaces reworded to name .planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md instead of a phase; a committed character-state-machine guard (docs-dangling-refs.test.ts) now fails if any shipped string literal names a phase number
- [Phase 11.1-02]: D-11.1-02: gen-enums, export-lbl, import-lbl documented in c64-memory-mapping/c64-program-recon; the symbol round trip documented as one closed loop matching Phase 11's live walkthrough, not two one-way dumps
- [Phase 11.1-02]: check-skill-tool-coverage.mjs's r2000 CLI verb list is parsed from r2000-cli.ts's dispatch switch (scripts/lib/r2000-cli-verbs.mjs), never hand-typed -- proven non-vacuous by a committed planted-violation test
- [Phase 11.1-03]: INT-01/D-11.1-03 -- hostpath-consumers.test.ts's r2000 absence list is now readdirSync-derived with a floor (>= 14) rather than a hard-coded 10-name array; the four previously-uncovered modules (r2000-acme-ident.ts, r2000-regbits-gen.ts, r2000-symbols.ts, r2000-test-gate.ts) are now covered and confirmed clean
- [Phase 11.1-03]: Phase 10 IN-02 -- the hostpath.ts import detector now matches the whole comment-stripped source with the m flag (catching multi-line named imports) plus a dedicated dynamic-import pattern (catching await import(...)), each proven by a committed planted-violation test
- [Phase 11.1]: D-11.1-04 (WR-10): default runR2000() timeout 120s, maxBuffer 32 MiB, proven live against real regenerator2000 0.9.20 (38/38 pass) and the timeout proven real via a separate child process.
- [Phase 11.1]: D-11.1-05 (INT-02): r2000-launch.ts's header corrected to name r2000-mcp-client.ts as a second, necessary async spawn site; R2000-01's guard-before-spawn invariant is now checked by r2000-spawn-seam.test.ts over the shipped module set (package.json files[]), not a raw directory listing, to exclude r2000-test-gate.ts's legitimate --version probe.
- [Phase 11.1]: D-11.1-06 (Phase 11 IN-02): regenerateAndReload() marked library-only rather than given an invented caller; a biconditional guard in r2000-symbol-roundtrip.test.ts ties the LIBRARY-ONLY marker to the real production-caller count in both directions.
- [Phase 11.1]: 11.1-05: WR-11 pinned bidirectionally via fileClaimViolations(); IN-03's isStandaloneDisasmToken() excludes hyphen-adjacent-letter shapes to stop false-positiving on Phase 4's disasm-*.ts; IN-01's drained/bounded process.exit() also fixed a self-inflicted EPIPE-crash regression, using a test-only env-var hatch since neither plan-named payload route scales past ~220 bytes on this host's regenerator2000
- [Phase 11.1]: IN-06 map is built from ground-truth code behaviour, not USAGE text; export-asm's USAGE was corrected to document its real --entry forwarding
- [Phase 11.1]: verify refuses both --out and --force (the identical accepted-but-ignored shape), not just the --out case IN-06 named
- [Phase 11.1]: WR-12's tautology only reproduces when writeChain's write formula and extractEntry's read formula are mutated together in a self-consistent way; a single-sided mutation breaks the round-trip test too
- [Phase 11.1-07]: AUDIT-01/04/05 closed: every Phase 10/11 review finding now has a cited disposition (11 fixed, 1 deferred); STATE.md's Deferred Items is derived from .planning/todos/pending/ and guarded both directions; Operator Next Steps names the two remaining Phase 10 coverage commands then /gsd-complete-milestone v0.3.0
- [Phase 11.1-07]: Task 4's ledger-completeness guard (docs-review-disposition.test.ts), scanning every phase not just 10/11, found 27 undispositioned findings before this plan (7 in Phase 10/11, 20 outside it: Phase 01 six, Phase 02 one, Phase 08 nine, Phase 09 one, Phase 11 one) versus the plan's own pre-measured 8 -- confirming the process risk was real and larger than predicted; closed to zero by fixing (Phase 01, quick task 260821-a86) or filing (Phase 08) each

### Pending Todos

14 pending — see `.planning/todos/pending/` (`/gsd-capture --list`). Net -1 this
plan: 2 closed (the dynamic-import closure-walk todo, the residual Phase 10
review findings todo — both fully resolved, see Quick Tasks / decisions below),
1 added (`2026-08-20-vsf-as-a-bootstrap-input.md`, filed by 11-03/D-34).

Newest: `2026-08-20-vsf-as-a-bootstrap-input.md` — `.vsf` as a regenerator2000
bootstrap input, deferred: no `R2000-*` requirement covers it, Phase 9 found
its machine-type auto-detection unreliable, and the D-01 synthesis route never
hands regenerator2000 a container format. Reverses if a consumer has only
`.vsf` captures and cannot re-capture as `.raw`.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260817-n6p | Fix WR-01 — bound `decode()`'s `startAddress` to `0..0xffff` in `disasm-decoder.ts` | 2026-08-17 | e19d8eb |  | [260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i](./quick/260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i/) |
| 260818-nh5 | Close Phase 07 UAT gap: fix stale evidence-key assertion in `stock-live-triage.test.ts`, restore the restarted live proof, and close the manual-only gate hole | 2026-08-18 | acc9933 (+84cca54, 9831fa8) |  | [260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc](./quick/260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc/) |
| 260818-obc | Live-prove the broker-mediated `monitor_held_elsewhere` verdict and the broker-supervised `restarted` respawn against a real host broker daemon and genuine stock VICE (both 3.9/3.10); closes TIME-04 | 2026-08-18 | 662dfd4, 0b236f1, b3965eb, d2a9235 |  | [260818-obc-live-prove-the-broker-mediated-monitor-h](./quick/260818-obc-live-prove-the-broker-mediated-monitor-h/) |
| 260819-rop | Fix milestone-audit D4-2 and NEW-1: stop ROADMAP.md asserting Phase 7 owns disk detach, and correct the D-07 "same argument shape" claim to backward-compatible at all six live sites plus a structural test pinning it | 2026-08-19 | f574e21, 79af9a7, 3344809 |  | [260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone](./quick/260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone/) |
| 260819-tsz | Replace six hand-maintained version strings with one `VERSION` template (`0.2.-`, `-` = auto-managed slot) plus a resolver seam, wired into CI; a hand minor/major bump now publishes X.Y.0 instead of continuing the old patch count | 2026-08-19 | 38a56ac..811746b (16 commits) | passed (verifier returned `partial` on a stale-README gap; gap closed in 7665025, and 8/8 code-review findings fixed) | [260819-tsz-single-version-template-plus-resolver-sc](./quick/260819-tsz-single-version-template-plus-resolver-sc/) |
| 260819-vie | Fix the release-asset gap: extract stamp+zip+upload into one seam (`scripts/release-assets.sh`) called by both release paths, since `release-on-merge`'s GITHUB_TOKEN tag cannot re-trigger the tag-gated `release` job; v0.2.0's missing plugin zip attached retroactively | 2026-08-19 | 4867535..ee296c0 (4 commits, all `[skip release]`) | passed (asset verified by download: zip + sha256, `plugin.json`/`marketplace.json` all `0.2.0`) | [260819-vie-extract-release-stamp-zip-upload-into-on](./quick/260819-vie-extract-release-stamp-zip-upload-into-on/) |
| 260820-jwb | Post-Phase-9 repo hygiene: bound CI's ACME install with a 5-minute timeout and 3-attempt apt retry (todo closed), gitignore `.vice-snapshots/`/`.vscode/`/`.claude/settings.json` with tarball-drift verification, and correct four stale ahead-of-`origin/main`-at-a-superseded-tag release claims to the true v0.2.0-shipped position | 2026-08-20 | 393ddf7, 5fbf66b, b86e596, 828bea4, 823943c | passed (npm tarballs unaffected, `test:automated` 1699/1704 unchanged) | [260820-jwb-post-phase-9-repo-hygiene-ci-acme-timeou](./quick/260820-jwb-post-phase-9-repo-hygiene-ci-acme-timeou/) |
| 260821-a86 | Close Phase 11's three open SECURITY.md findings: WR-01's parent-realpath containment in `resolveStorePath()` (deepest-existing-ancestor walk + dangling-symlink-component refusal), T-11-NAME-INJECT's REJECT policy on both label-name entry routes (`r2000_set_label_name` outer *and* batch-inner, `importLabels()` naming the offending `.lbl` line) via a new dependency-free `r2000-acme-ident.ts` seam, and WR-04's Markdown-cell escaping in `renderMemoryMap()`; `11-SECURITY.md` flipped to `threats_open: 0` / `status: verified` | 2026-08-21 | de788b9, bb08c46, 2c287cb | passed (orchestrator re-ran the gates independently: `tsc --noEmit` clean, `test:automated` 1947 tests / 1942 pass / 0 fail / 5 pre-existing todo, `check-npm-packages.mjs` green, all three controls confirmed present in source) | [260821-a86-fix-phase-11-security-md-open-findings-w](./quick/260821-a86-fix-phase-11-security-md-open-findings-w/) |
| 260821-jd8 | Close 10-REVIEW.md's WR-08, Phase 10's last open security finding: `parseArgs()`'s `--entry`/`--out` refused a missing or flag-shaped value (`bootstrap x.prg --out --entry FOO` wrote a project literally named `--entry`); reused `parseExportLblArgs()`'s existing guard shape across all three verbs that route through `parseArgs()` (`bootstrap`, `export-asm`, `verify`); pinned by 10 new tests proven non-vacuous against a scratch pre-fix revert; assigned T-10-19, `10-SECURITY.md` flipped to `threats_open: 0` / `status: verified`; pending todo moved to `completed/` with a Resolution section | 2026-08-21 | 3541886, e0fd305 | — | [260821-jd8-close-wr-08-flag-shaped-option-values](./quick/260821-jd8-close-wr-08-flag-shaped-option-values/) |

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

**13 items acknowledged and deferred at the v0.2.0 milestone close on 2026-08-19**
(superseded by the current count below, kept here as history rather than
overwritten). The pre-close artifact audit reported these; the round-4
milestone audit had already assessed the same set as `tech_debt` with no
blockers. They were accepted rather than resolved, and were v0.3.0's
inheritance unless dispositioned sooner.

**Current, as of quick task 260821-jd8 (2026-08-21): 17 items, derived from
`.planning/todos/pending/` and guarded by `docs-deferred-ledger.test.ts`
(AUDIT-04) — this table is no longer hand-maintained.** 5 of the 17 were opened
during v0.3.0 (`2026-08-20-fully-remove-the-forked-vice-mcp-backend`,
`2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json`,
`2026-08-20-vsf-as-a-bootstrap-input`,
`2026-08-20-warp-over-resource-set-refuted-on-stock-3-10`); 3 more were opened
by Phase 11.1 itself while dispositioning Phase 10/11's review findings and
building Task 4's completeness guard, which caught undispositioned findings
outside Phase 10/11 too
(`2026-08-21-migrate-hand-copied-acme-gates-to-r2000-test-gate`,
`2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments`,
`2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned`).
**Three rows from the 2026-08-19/18-items counts above are removed here
because their todos now live in `.planning/todos/completed/`, not because the
items were dropped:** the second-binmon-client wedge-lookalike documentation
todo (2026-08-17), the acme-build scaffold-library todo (2026-08-19), and
WR-08's flag-shaped/missing option-value todo (2026-08-21, closed by quick
task 260821-jd8 — assigned T-10-19 in `10-SECURITY.md`, now `status:
verified` / `threats_open: 0`) are all resolved and closed — see
`.planning/todos/completed/` for the filed resolutions.

| Category | Item | Priority | Status |
|----------|------|----------|--------|
| todo | 2026-08-13-confirm-help-discriminator-against-real-vice-binaries | high | Pending — BACK-01/BACK-04's `--help` backend discriminator unconfirmed against real stock and fork binaries |
| todo | 2026-08-13-re-record-binmon-fixtures-against-real-stock-vice | high | Pending — VERIF-02's three capturable fixtures are synthetic, honestly marked in every sidecar |
| todo | 2026-08-14-probe-phase3-assumed-wire-details | high | Pending — four Phase 3 behavioural/spelling details written spec-driven, never exercised against a real binary |
| todo | 2026-08-13-reconcile-ci-test-command-with-narrowed-gate | — | Pending — CI runs bare `npm test`, not `npm run test:automated`; both verified green from the main checkout, so the divergence hides no red gate |
| todo | 2026-08-12-vice-broker-tests-stall-outside-devcontainer | low | Pending — pre-existing, user-dispositioned 2026-08-12 as "not a bug to fix" |
| todo | 2026-08-19-drive-type-prerequisite-undocumented-in-readme-and-skill | — | Pending |
| todo | 2026-08-19-keyboard-fallback-load-does-not-progress-within-bounded-poll | — | Pending — FINDING-E2; does not affect DIST-03, whose passing route was `vice_autostart` |
| todo | 2026-08-19-project-paths-git-marker-requirement-undocumented | — | Pending |
| todo | 2026-08-19-releases-json-schema-undocumented | — | Pending |
| todo | 2026-08-19-vice-ping-resolvedbinarypath-misleading-under-broker-pool | — | Pending |
| todo | 2026-08-20-fully-remove-the-forked-vice-mcp-backend | — | Pending — opened during v0.3.0; not scoped to this milestone |
| todo | 2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json | — | Pending — opened during v0.3.0; packaging change, not scoped to this milestone |
| todo | 2026-08-20-vsf-as-a-bootstrap-input | — | Pending — filed by plan 11-03/D-34; no `R2000-*` requirement covers `.vsf` as a bootstrap input |
| todo | 2026-08-20-warp-over-resource-set-refuted-on-stock-3-10 | — | Pending — opened during v0.3.0; three doc/manifest sites plus a fork-tool claim to correct |
| todo | 2026-08-21-migrate-hand-copied-acme-gates-to-r2000-test-gate | — | Pending — IN-07 (10-REVIEW.md); two (now three-file-scoped) hand-copied `probeR2000()` gates, deferred because `r2000-cli.test.ts`'s gate semantics are load-bearing for already-verified Phase 11 evidence |
| todo | 2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned | — | Pending — 9 findings from v0.2.0's 08-REVIEW.md, found by Task 4's completeness guard; 3 spot-checked and confirmed still live, out of this phase's r2000-only scope |
| todo | 2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments | — | Pending — found while writing plan 11.1-07's disposition ledger; two comment-only "Phase 7"/"Phase 8" pointers outside the r2000 family and outside plan 11.1-01's string-literal-only guard by design |
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

Also carried, not blocking, from Phase 11.1's own disposition ledger (filed
under `.planning/todos/completed/`, dated 2026-08-21): the test-only
env hatch `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES` in `vice-proxy.ts` (narrow,
inert unless explicitly set, no user-facing surface); the comment-scope gap in
plan 11.1-01's phase-pointer guard (`r2000-project.ts`'s one comment-only
FLOW-02 site is permanently outside that guard's string-literal-only reach);
`r2000-cli.test.ts`'s harmless duplicate of `writeChain()`'s used-byte formula
(used only to build unrelated CLI fixtures, never to verify the DOS
convention); and `02-REVIEW.md`'s IN-05 (`stockReconnect()`'s thrown message
still says `stockConnect:`), the one genuinely open v0.2.0 code-review
straggler confirmed live in current source — a trivial one-line fix, left
open because `stock-connect.ts` sits outside this phase's r2000/disassembler
scope.

### Carried forward from earlier closes

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Defect | `Drive8Type=0` default on stock broker launch blocked all program loads (`.d64` and bare `.prg` alike) via `c64-ram-capture` (FINDING-C1); fix `-drive8type 1541` at launch | **Fixed** — Phase 8.2 plans 02-04 landed the fix, proved it live, and re-ran the walkthrough to a recorded `pass` | v0.2.0 Phase 8.1 (2026-08-19), fixed in Phase 8.2 (2026-08-19) |
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | Deferred | v0.2.0 scoping |
| Quality | QUAL-02 — orphaned planning references in source comments | Deferred | v0.2.0 scoping |
| Quality | QUAL-03 — emulator control-plane network exposure | Deferred | v0.2.0 scoping |

## Session Continuity

Last session: 2026-08-21T11:10:28.293Z
Stopped at: Completed 11.1-07-PLAN.md
Resume file: None

## Operator Next Steps

Phase 11.1 has closed v0.3.0's audit items (AUDIT-01 through AUDIT-05, FLOW-01,
FLOW-02, INT-01, INT-02). All three v0.3.0 phases (9, 10, 11) plus this
closure phase are complete. Two Phase 10 coverage gaps remain, deliberately
run as separate commands rather than folded into an 11.1 plan (D-11.1-08 —
they write phase-10 artifacts, which an 11.1 commit should not carry):

- `/gsd-validate-phase 10` — `10-VALIDATION.md` is still the pre-execution
  planning snapshot (`status: planned`, all six task rows `⬜ pending`,
  sign-off unchecked). The validation itself already happened —
  `10-VERIFICATION.md` ran the full suite green plus all four CI guard
  scripts at exit 0 and source-level mutation-kill testing — so this command
  closes the paperwork retroactively rather than re-running anything.

- `/gsd-secure-phase 10` — no `10-SECURITY.md` exists, despite Phase 10 being
  the phase that introduced untrusted-input byte parsers (`r2000-d64.ts`'s
  sector walker, `r2000-project.ts`'s `parsePrg`). Two of the phase's own
  review findings (WR-05, WR-07) were input-handling defects — exactly the
  surface a threat model covers. Phase 11's `11-SECURITY.md` is the model:
  `status: verified`, `threats_open: 0`.

Then close the milestone: `/gsd-complete-milestone v0.3.0`. Nothing else
blocks it — all 12 in-scope `R2000-*` requirements are satisfied, all three
phases are `passed`, and § Deferred Items above is now derived from
`.planning/todos/pending/` rather than hand-maintained, so the milestone-close
command reads an accurate deferred set.

Nothing to publish beyond the milestone tag itself: `v0.2.0` is tagged,
pushed, and live on npm for both packages, and the tree is in sync with
`origin/main`.
