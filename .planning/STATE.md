---
gsd_state_version: 1.0
milestone: v0.7.0
milestone_name: Own the Annotation Store
current_phase: 28
current_phase_name: The Store Core
status: gaps_found
stopped_at: Completed 28-12-PLAN.md
last_updated: "2026-08-28T09:37:22.519Z"
last_activity: 2026-08-28
last_activity_desc: Phase 28 second gap-closure round executed (28-10..28-12); round-3 re-verification returned gaps_found at 10/12
state_head: 8c19362c32cb1d2065cb4692dfe593a516ad6924
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 17
  completed_plans: 17
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-26 at the start of milestone v0.7.0)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
*Flag discharged 2026-08-23 by `CORE-01` (Phase 17, plan 17-02): the verdict is
**keep-dated** — the statement above is left byte-identical, and PROJECT.md →
Core Value now carries the dated record of the evidence weighed, the case against
the verdict, and a specific reversal condition. Pinned by
`docs-core-value-decision.test.ts`. It still says nothing about findings that
outlive the session; that omission is now a decision rather than a default.*

**Closed incomplete:** v0.6.0 Own the substrate — 2026-08-26, after 1 of 4
phases. Phase 23 was written as a pre-committed go / degrade / no-go gate with the
authority to narrow or cancel every phase after it, and it **fired**: `no-go`,
rule `R1`, on the input `C0_CORPUS: partial`
(`docs/phase23-real-release-gate-findings.md`). Six of its eleven plans executed
and five were deliberately not dispatched. **Phases 24 and 26 are held** with live
requirement text for v0.8.0, blocked on a frame-exact emulator stop that nothing
owns; **Phase 25 was taken forward** as the whole of v0.7.0. No milestone audit was
run, and that is a statement rather than an omission — the gate had already
recorded, under three accepted overrides, that the intent was not delivered, and
Phase 23's findings document is the audit of record. Neither `ROADMAP.md` nor
`REQUIREMENTS.md` was archived, because Phases 24 and 26 are held with live text.
**Shipped:** v0.5.0 Persistent Session and the Coverage Instrument —
2026-08-25 (2 executed phases, 27 plans, 61 tasks, 13/27 requirements,
`override_closeout`). A regenerator2000 session now survives many tool calls
with crash recovery and a FIFO queue; all five upstream analyze procedures are
absorbed and attributed at a pinned commit as a seventh skill joins the set; and
a derived-from-bytes coverage census exists that the store's own block table
cannot move by a single byte. Phases 20-22 were **cut** on 2026-08-25 by the
dxa+Ghidra pivot — nothing was attempted and failed, and their 14 requirements
(DECOMP-*, BUILD-*, EQUIV-*) are held for v0.7.0.
**Previously:** v0.4.0 Debt discharged, decisions settled — 2026-08-23 (6 phases,
44 plans, 119 tasks, 16/16 requirements, audit round 1 `tech_debt` with zero
blockers and zero open gaps). The inherited ledger drained from 19 items to
**0**; `FORK-01` (**retain**) and `CORE-01` (**keep-dated**) are dated decisions
pinned by their own guards; `scripts/audit-gate.mjs` makes a clean audit status
impossible over a red docs guard, and was observed refusing all four write
routes; and the plugin payload now lives under `src/` with both tarballs still
validated.
**Before that:** v0.3.0 regenerator2000 static-analysis backend — 2026-08-21 (4
phases, 36 plans, 12/12 in-scope requirements, audit round 2 `passed`). Recon
findings are queryable state: 17 curated `r2000_*` tools and 7 `vice-mcp r2000`
CLI verbs over a persistent annotation store, container-side and structurally
incapable of touching VICE.
**And before that:** v0.2.0 Switchable stock-VICE backend — 2026-08-19 (9 phases, 87
plans, 51/51 in-scope requirements). Stock upstream `x64sc` is a first-class,
project-selectable backend with 38 tools; the fork keeps its 62 unchanged.

**Current focus:** Phase 28 — The Store Core
Milestone **v0.7.0 Own the Annotation Store**, opened 2026-08-26. 28 requirements
(`SEAM-*`, `STORE-*`, `MCP-*`, `EXPORT-*`, `REPOINT-*`, `CUT-*`), all 28 mapped to
**six** phases in `.planning/ROADMAP.md` (Phases **27-32**) — one requirement to
one phase, no orphans and no duplicates, verified mechanically against the
roadmap's own per-phase `**Requirements**:` lines rather than by eye. What the
milestone delivers: this project owns the annotation state it has been renting
from regenerator2000, the five already-absorbed analysis procedures run on that
store, and regenerator2000 is deleted outright behind a gate observed biting.

**Two owner decisions taken at the open**, both narrowing v0.6.0's Phase 25 text:
**no parity is owed to regenerator2000** — the "same facts" deletion gate and
`STORE-04`'s `R2000-11` carry-across are both removed — and **the Phase 24 engine
coupling is dropped**, so the store stands on the `disasm-*` decoders this project
already owns.

**This milestone carries no corpus dependency, which is why it is reachable while
Phase 23's recorded `no-go` (rule `R1`) stands.** That verdict is **not**
overridden here: it gates work needing a depacked real-release capture, and
nothing in Phases 27-32 needs one. Every external oracle this milestone leans on
is already installed and was run live during research — a real ACME 0.97,
`node:sqlite` at the declared Node floor, and this repository's own tree at HEAD.

**The sequence is constrained, not preferred.** Eight hard ordering constraints,
each derived from code, are recorded per phase in `ROADMAP.md` and collected in
its `## Sequencing Rationale (v0.7.0)`. The two most easily got wrong: the
**registration-time** guards move in **Phase 29**, because two CI gates break on
the *rename* and not on the deletion (research calls this the single most
important sequencing fact); and the real-ACME oracle must stand at **Phase 30**,
before the deletion window opens at **Phase 32**, or every claim made inside that
window sits at fixture level.

**Held and future scope, deliberately unmapped and not in this milestone's
denominator.** `DXA-*`, `GHID-*`, `OPC-*`, `AUTO-*` and `PROOF-*` stay held with
v0.6.0's **Phases 24 and 26**, whose numbers are reserved and whose requirement
text is live for v0.8.0 — blocked on one thing, a **frame-exact emulator stop**,
which nothing owns
(`todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md`).
`DECOMP-01..04`, `BUILD-01..06` and `EQUIV-01..04` were re-mapped to **v0.9.0** on
2026-08-26; `DECOMP-01` is precisely what `STORE-01`'s 12-member type vocabulary
is sized for, which is why that vocabulary is the milestone's one irreversible
decision and is settled in Phase 28.
**Phase numbering starts at 27**, and no number is ever reused: Phases 20-22 were
cut, Phases 24 and 26 are held with their numbers reserved, and Phase 25's
*content* was taken forward into v0.7.0 while its *number* retired with v0.6.0.
**Phase directories are NOT archived**, and the reason has grown rather than
weakened: five committed tests read live paths under `.planning/phases/`, two of
them by hard-coded relative path to Phase 19's `upstream-procedure-manifest.json`
— which is a **design input** to this milestone, not merely a guard's fixture.
Every close therefore passes `--no-archive-phases`.
**What became of `R1`'s two named branches, recorded precisely rather than
smoothed over.** `R1` said *secure a corpus first, or re-scope v0.6.0 to a claim
explicitly qualified as fixture-only.* **Neither branch was literally taken.**
v0.6.0 was closed incomplete instead, and the one part of it with no corpus
dependency — its Phase 25 — was taken forward as v0.7.0, with Phases 24 and 26
held against the unowned frame-exact-stop blocker. That is a third resolution, not
one of the two the rule pre-named, and it is written down here rather than
presented as though the rule anticipated it.

**Collapsed history.** `ROADMAP.md` carries all four shipped milestones collapsed,
with full detail in `milestones/v0.2.0-ROADMAP.md`,
`milestones/v0.3.0-ROADMAP.md`, `milestones/v0.4.0-ROADMAP.md` and
`milestones/v0.5.0-ROADMAP.md`. v0.6.0 is **not** collapsed and **not** archived —
its phase details live in `ROADMAP.md` under
`## v0.6.0 Own the substrate — CLOSED INCOMPLETE (Phase Details)`, below v0.7.0's,
because Phases 24 and 26 are held with live requirement text.

The Deferred Items ledger below reads **9 open** pending todos (it read 0 at the
v0.4.0 close; all nine were filed after it); the suppressed/acknowledged rows are
recorded in their own sections.

## Current Position

Phase: 28 (The Store Core) — GAPS FOUND
Plan: 12 of 12 executed; second gap-closure round (28-10..28-12) complete
Status: 10/12 must-haves. All five ROADMAP success criteria VERIFIED for a third round, and round 2's two gaps are CLOSED (CR-01/CR-02/CR-04 re-verified; CR-03 closed for its reported cause). Two NEW blockers keep the goal's REVERTIBLE clause false: CR-05 (the ring is keyed on the store path's basename spelling, so a second spelling of the same file makes the next write delete every pointer row) and CR-06/CR-07/WR-12 (a transaction with no structural lifetime, plus two holes in the ViceError family — an ordinary setDataType can report SUCCESS while leaving the handle permanently wedged). All six STORE requirements reverted out of Complete. See 28-VERIFICATION.md and 28-REVIEW.md.
Last activity: 2026-08-28 — Phase 28 second gap-closure round executed; round-3 verification returned gaps_found at 10/12

## Performance Metrics

**Velocity:**

- Total plans completed: 198
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
| 13 | 5 | - | - |
| 12 | 7 | - | - |
| 14 | 5 | - | - |
| 15 | 12 | - | - |
| 16 | 11 | - | - |
| 17 | 4 | 2026-08-23 | Ledger closed to 0; CORE-01 decided keep-dated; G-17-1 provenance correction |
| 18 | 7 | - | - |
| 19 | 20 | - | - |
| 23 | 6 | - | - |
| 27 | 5 | - | - |

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
| Phase 12 P01 | 90min | 2 tasks | 2 files |
| Phase 12 P02 | 150min | 3 tasks | 3 files |
| Phase 12 P03 | 40min | 2 tasks | 4 files |
| Phase 12 P04 | 35min | 1 tasks | 1 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 12 P05 | 22min | 3 tasks | 3 files |
| Phase 12 P06 | 55min | 3 tasks | 2 files |
| Phase 13 P01 | 40min | 3 tasks | 11 files |
| Phase 13 P02 | 27min | 2 tasks | 7 files |
| Phase 13 P03 | 25min | 3 tasks | 2 files |
| Phase 13 P04 | 25min | 3 tasks | 7 files |
| Phase 13-external-verification P05 | 35min | 3 tasks | 8 files |
| Phase 14 P01 | 17min | 3 tasks | 4 files |
| Phase 14 P02 | 22min | 3 tasks | 2 files |
| Phase 14 P03 | 25min | 2 tasks | 6 files |
| Phase 14 P04 | 37min | 2 tasks | 4 files |
| Phase 14 P05 | 26min | 2 tasks | 6 files |
| Phase 15 P01 | 28min | 3 tasks | 5 files |
| Phase 15 P02 | 22 min | 3 tasks | 3 files |
| Phase 15-debt-and-review-disposition P03 | 19min | 3 tasks | 6 files |
| Phase 15 P04 | 40min | 3 tasks | 7 files |
| Phase 15 P08 | 24min | 3 tasks | 3 files |
| Phase 15 P05 | 45min | 3 tasks | 6 files |
| Phase 15-debt-and-review-disposition P06 | 35min | 3 tasks | 6 files |
| Phase 15 P07 | 55min | 3 tasks | 12 files |
| Phase 15 P09 | 40min | 3 tasks | 10 files |
| Phase 15 P10 | 28min | 3 tasks | 8 files |
| Phase 15 P11 | 40min | 3 tasks | 11 files |
| Phase 15 P12 | ~40min (estimated) | 3 tasks | 14 files |
| Phase 16 P01 | 50min (estimated) | 3 tasks | 46 files |
| Phase 16-packaging-and-repo-shape P02 | 25min | 2 tasks | 3 files |
| Phase 16 P03 | 10min | 2 tasks | 3 files |
| Phase 16 P04 | ~55min | 3 tasks | 238 files |
| Phase 16 P06 | 55min | 3 tasks | 3 files |
| Phase 16 P07 | ~90min | 3 tasks | 15 files |
| Phase 16 P05 | 40min | 3 tasks | 6 files |
| Phase 16 P08 | 40min | 3 tasks | 6 files |
| Phase 16 P09 | 35min | 2 tasks | 5 files |
| Phase 16 P10 | ~70min | 3 tasks | 8 files |
| Phase 16 P11 | 30min | 2 tasks | 2 files |
| Phase 17 P01 | 20min | 2 tasks | 2 files |
| Phase 17 P02 | 25min | 2 tasks | 3 files |
| Phase 17 P03 | 35min | 3 tasks | 5 files |
| Phase 18 P01 | 40min | 3 tasks | 5 files |
| Phase 18 P02 | 30min | 2 tasks | 2 files |
| Phase 18 P03 | 105min | 3 tasks | 8 files |
| Phase 18 P04 | 90min | 3 tasks | 8 files |
| Phase 18 P05 | 75min | 3 tasks | 4 files |
| Phase 19 P01 | 45min | 3 tasks | 11 files |
| Phase 19 P02 | 38 min | 2 tasks | 7 files |
| Phase 19 P03 | 19 min | 2 tasks | 20 files |
| Phase 19 P04 | 25 min | 2 tasks | 9 files |
| Phase 19 P05 | 46 min | 3 tasks | 15 files |
| Phase 19 P06 | 22 min | 2 tasks | 2 files |
| Phase 19 P07 | 2h | 3 tasks | 5 files |
| Phase 19 P08 | 30 min | 2 tasks | 2 files |
| Phase 19 P09 | 55 min | 3 tasks | 8 files |
| Phase 19 P14 | 8 min | 2 tasks | 1 files |
| Phase 19 P10 | 26 min | 3 tasks | 8 files |
| Phase 19 P11 | 30 min | 2 tasks | 3 files |
| Phase 19 P12 | 31 min | 2 tasks | 2 files |
| Phase 19 P13 | 23 min | 3 tasks | 4 files |
| Phase 19 P15 | 58 min | 3 tasks | 8 files |
| Phase 19 P16 | 14 min | 3 tasks | 3 files |
| Phase 19 P17 | 45 min | 3 tasks | 2 files |
| Phase 19 P18 | 26 min | 3 tasks | 4 files |
| Phase 19 P20 | 29 min | 3 tasks | 4 files |
| Phase 19 P19 | 20 min | 2 tasks | 2 files |
| Phase 23 P01 | 9 min | 3 tasks | 4 files |
| Phase 23 P02 | 34 min | 3 tasks | 16 files |
| Phase 23 P04 | 33 min | 2 tasks | 2 files |
| Phase 23 P03 | 1h 55m | 3 tasks | 7 files |
| Phase 23 P10 | 47 min | 3 tasks | 5 files |
| Phase 23 P11 | 22 min | 3 tasks | 4 files |
| Phase 27 P01 | 15 min | 3 tasks | 7 files |
| Phase 27 P02 | 40 min | 3 tasks | 7 files |
| Phase 27 P03 | 8 min | 3 tasks | 14 files |
| Phase 27 P04 | 17 min | 3 tasks | 8 files |
| Phase 27 P05 | 49 min | 3 tasks | 2 files |
| Phase 28 P01 | 21 min | 3 tasks | 7 files |
| Phase 28 P02 | 19 min | 2 tasks | 1 files |
| Phase 28 P04 | 27 min | 3 tasks | 4 files |
| Phase 28 P03 | 22 min | 3 tasks | 3 files |
| Phase 28 P05 | 21 min | 2 tasks | 4 files |
| Phase 28 P06 | 26 min | 3 tasks | 5 files |
| Phase 28 P07 | 16 min | 2 tasks | 2 files |
| Phase 28 P08 | 21 min | 2 tasks | 3 files |
| Phase 28 P09 | 20 min | 2 tasks | 3 files |
| Phase 28 P10 | 14 min | 3 tasks | 4 files |
| Phase 28 P11 | 22 min | 2 tasks | 2 files |
| Phase 28 P12 | 24 min | 2 tasks | 4 files |

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

- v0.5.0 opened as Phases 18-22, continuing v0.4.0's numbering rather than
  resetting to 1. Kept the research-proposed 5-phase shape (persistent session
  -> absorption+coverage instrument -> decomposition -> rebuildable
  source+hazard gate -> equivalence/modifiability) rather than fragmenting
  further: EQUIV-01 (compare.mjs's original-vs-different-binary extension,
  this milestone's single highest-risk requirement) stays inside Phase 22 as
  its first, explicitly-flagged success criterion rather than becoming a
  standalone phase — splitting it would exceed this project's "standard"
  granularity calibration (4-6 phases) without changing what has to be built
  or in what order. Full sequencing rationale recorded in ROADMAP.md ->
  "Sequencing Rationale (v0.5.0)".

- **v0.6.0 opened as Phases 23-26 (2026-08-25), starting at 23 rather than at
  20.** Phases 20, 21 and 22 were cut at the v0.5.0 close, dissolved by the
  dxa+Ghidra pivot rather than abandoned; their numbers are never reused. The
  four-phase shape is: a standalone real-release go/degrade/no-go gate (23),
  the two engines (24), the annotation store and the r2000 cutover (25), and
  automatic annotation (26).

- v0.6.0: the assumption gate is a **phase**, not a criterion inside one — the
  second time this project has made that call (Phase 9 was the first, and its
  gate fired for real, returning `degrade`). `PROOF-05`'s failure mode is
  *reconsider the milestone*, not *replan the phase*: every number behind the
  dxa+Ghidra pivot comes from one 279-byte fixture written by the same person
  testing it, and if it does not survive real cracked code, Phases 24-26 are
  not the same phases.

- v0.6.0: `OPC-01..03` (the 105-byte undocumented-opcode SLEIGH extension) is
  kept **inside** Phase 24 rather than split into its own phase. Its
  verification is not separable — `OPC-03` can only be checked by running the
  harness `GHID-01` delivers, and `GHID-04`'s acceptance (structural facts from
  real cracked code) is not honestly claimable while 105 opcode bytes are
  undecodable, since crack and packer code is exactly where that gap bites. A
  split would force Phase 24 to close on a claim its own corpus contradicts.
  Full rationale in ROADMAP.md → "Sequencing Rationale (v0.6.0)".

- v0.6.0: the cutover (`CUT-01..03`) rides with the annotation store in Phase 25
  rather than becoming a fifth phase. The deletion is only safe once a
  replacement demonstrably produces the same facts, and `CUT-02`'s reuse
  decisions are decisions about what the store is built out of. Split apart,
  Phase 25 would end with the replacement standing beside its predecessor —
  the exact state `CUT-01` exists to prevent.

- v0.6.0: four new **Standing Constraints** added to ROADMAP.md at the open,
  each a hazard demonstrated on a committed fixture during the pivot
  exploration and each of which fails *silently*: Ghidra deletes hardware
  writes without volatile I/O blocks; structural facts live in
  `DecompInterface`, never `DataTypeManager`; a `memmap.json` lookup is
  bank-parameterised and narrowest-range-wins; dxa is the discovery engine and
  nothing more.

- **v0.6.0: the gate fired, and it returned `no-go` (2026-08-26).** The second time
  this project made the assumption probe a phase rather than a criterion, and the
  second time the pre-committed rule bit: Phase 9's `R4` returned `degrade` and
  shipped a smaller correct milestone; Phase 23's `R1` returned **`no-go`** on
  `C0_CORPUS: partial`, five plans before the measurement it gates existed. `R1`'s own
  text names what the milestone becomes — *secure a corpus first, or re-scope v0.6.0 to
  a claim explicitly qualified as fixture-only* — and that decision is deliberately
  **not** taken here: it belongs to whoever plans Phase 24. Six of Phase 23's eleven
  plans executed; 23-05..23-09 were deliberately not dispatched for want of the
  depacked capture substrate (D-03). Verdict at
  `docs/phase23-real-release-gate-findings.md`; Phases 24, 25 and 26 carry the
  amendment beside their success criteria, which are unchanged.

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
- [Phase 12]: audit-gate.mjs built as the single check point; the planted-violation test in audit-integrity.test.ts caught runGuardsLive() silently reporting green under a red guard when nested under an outer node --test (NODE_TEST_CONTEXT inheritance), fixed by stripping NODE_TEST_* from the guard subprocess env
- [Phase 12-02]: RESEARCH.md's Route A (piggyback on live PreToolUse hooks) does not hold on this host -- resolved A1 via session-transcript inspection instead, without registering a hook or restarting the session
- [Phase 12-02]: audit-gate.mjs's hook mode is fail-open outside the Write/Edit/MultiEdit/NotebookEdit/Bash + MILESTONE-AUDIT-token scope, fail-closed on every internal error once in scope; exit 2 plus stderr is the sole blocking mechanism, never exit-2-plus-permissionDecision JSON (anthropics/claude-code#43407)
- [Phase 12-03]: settings.json split into a committed hooks-only file (Write|Edit|Bash PreToolUse -> audit-gate.mjs --hook) and .claude/settings.local.json (merged machine-specific permissions, still ignored); MultiEdit/NotebookEdit deliberately left out of the matcher since neither was verified against the live hook runtime
- [Phase 12-03]: Layer 1 (audit-integrity.test.ts) now asserts the settings.json hook block itself (5 new tests), proven non-vacuous by two live break-and-restore probes against the real committed file (missing file -> exit 1; matcher narrowed to Write|Edit -> exit 1 naming the heredoc-bypass risk), closing T-12-09's silent-deletion gap
- [Phase 12]: GATE-01's real-tree proof confirms status: tech_debt is gated alongside status: passed (D-12-12); gaps_found is never gated (D-12-13). — Both tech_debt and passed route to /gsd-complete-milestone, so both must be blocked while a docs guard is red; a milestone honestly reporting open gaps must never be blocked from saying so.
- [Phase 12]: GATE-01's Bash-mode write-target scan is a content-adjacency heuristic, evadable by a base64/python -c runtime-assembled payload (T-12-02, accepted). — Layer 1 (audit-integrity.test.ts driving checkAuditGate(), which re-reads the actual committed file content regardless of how the shell wrote it) is the unevadable enforcement point; the hook is a deterrent, not the boundary.
- [Phase 12]: [Phase 12-05]: CR-01/CR-03 closed via a bounded, non-backtracking token locator (auditTokenOffsets/textNamesMilestoneAudit, indexOf-based) plus small fixed-length windows (256/512/4096 chars), replacing the two super-linear Bash regexes and the unbounded whole-text token regex; a new unanchored gated-status scan (declaresGatedStatusUnanchored, derived from the single GATED_STATUSES set) replaces the line-anchored scan specifically in the Bash branch, closing the single-line echo/printf/tee-a/sed-i append bypass while leaving the structured Write/Edit document-content branch's line-anchored scan untouched (preserves the T-12-04 false-positive defence). WR-04's dead pathish push removed. New accepted limitation T-12-20: an in-place edit whose script argument exceeds the 4096-char window is not detected (Layer 1 still catches the landed write).
- [Phase 12]: [Phase 12-06]: CR-02/WR-01/WR-02/WR-03 closed -- collectStringLeaves() converted to an iterative, depth-capped walk (MAX_LEAF_DEPTH=200, MAX_LEAF_NODES=50000) returning a truncation signal; hookMain() hoists the HOOK_MATCHER_TOOLS check above extraction and wraps scope determination in a try/catch; main()'s check-mode block is wrapped in one try/catch so a bad --root fails cleanly in both output modes; runGuardsLive() bounds its spawnSync to 15s (WR-01, gated at source level only, no behavioral timeout test); checkAuditGate() short-circuits before the guard spawn on a structural failure (WR-02). The --hook exit surface is now exactly {0, 2}.
- [Phase 13]: Captured against the fork build (command -v x64sc resolves to /usr/local/bin/x64sc on this host) rather than forcing genuine stock, recording the truthful fork: kind per D-13-01/D-13-02
- [Phase 13]: checkpoint-list terminator-frame reading CONFIRMED against real bytes; stock-protocol.ts left untouched
- [Phase 13]: Corrected checkpoint-list correlat: test's events.length (2 -> 8) against real capture bytes rather than loosening the assertion
- [Phase 13]: EXTV-02 shared with sibling 13-05; requirements.ready-ids correctly held 0/1 ready, not marked complete yet
- [Phase 13]: x64sc --help's own startup diagnostics are not byte-reproducible across runs (randomized VSP-bug channel line); discriminator substrings themselves are stable -- documented in 13-HELP-DISCRIMINATOR-EVIDENCE.md and fixtures README rather than silently worked around
- [Phase 13]: Phase 13 plan 03: probed A1/A2/A3/A5 live against fork VICE 3.10 -- A1/A2 CONFIRMED, A3 INCONCLUSIVE, A5 CONTRADICTED (AUTOSTART with runAfter=false still resets+loads); vice_disk_attach contract finding handed to plan 13-05
- [Phase 13]: Phase 13 plan 04: A1/A2 assumption labels removed (confirmed live against fork VICE 3.10); A3/A5 left assumed (INCONCLUSIVE/CONTRADICTED); A5's vice_disk_attach tool-contract finding handed to plan 13-05 via D-13-04's escape hatch; assumption-label-discipline.test.ts ships as a permanent all-or-nothing label guard
- [Phase 13]: Phase 13 plan 05: closed both retired verdicts in docs/phase2-backend-probe-evidence.md -- EXTV-01 (fork:/usr/local/bin/x64sc, VICE 3.10.0.0; terminator-frame reading CONFIRMED, event order differs from the synthetic model but matches phase1-probe-results.md) and EXTV-02 (probeBackend()/resolvedBackend() confirmed against both real binaries, -help/-? fallback branches recorded unexercised rather than verified); moved the fixtures and discriminator todos to completed/ with Resolution sections; trimmed the probe-phase3 todo to A4 only; filed two new pending todos (cpuhistory-get* sidecar mislabel; vice_disk_attach's D-14 approximation contradicted by A5); reconciled STATE.md's Deferred Items ledger against the post-phase todo tree -- docs-deferred-ledger.test.ts green in both directions
- [Phase 14]: FORK-01 decided `retain` by a human at the blocking-human checkpoint (14-01 Task 2): the forked VICE MCP backend stays the default hedge, formalised in PROJECT.md with a dated Key Decisions row naming KEYBOARD_MATRIX_SET reversal criteria. Sub-question B was NOT overridden.
- [Phase 14]: [Phase 14-02] FORK-02 evidenced true on the retain branch with zero rewrite: all 17 point-of-use mention sites verdicted holds-as-is; runtime refusal for vice_sid_get_state/vice_keyboard_matrix/vice_keyboard_restore pinned by three tests; capability-registry.ts and all 8 skill/doc files left unedited, recorded as the decided retain-branch outcome rather than an omission.
- [Phase 14]: fork-live.test.ts drives vice.ts's real HTTP transport seam (useInstance/call/serverInfo) against buildViceArgs()'s own fork-branch argv, forced to loopback -- registered as MANUAL_ONLY_TESTS entry 8 — Criterion 3 required the fork's own -mcpserver transport to be live-exercised at least once; no prior test in this repo had ever done so (broker-e2e.test.ts stubs the binary; the phase 8 human walkthrough and phase 13 live captures were stock-only or spoke the wrong protocol)
- [Phase 14]: [Phase 14-04] Retain branch recorded zero: both code-consequence tasks (fork-default flip in backend-detect.mts; vice-errors.ts extraction from vice.ts) confirmed skipped -- gated to non-retain branches by their own precondition; git diff --quiet -- .claude/mcp/vice clean
- [Phase 14]: [Phase 14-05] Closed the record: fully-remove-the-forked-vice-mcp-backend todo disposed retain (moved to completed/ with Resolution section); FORK-01/FORK-02 marked Complete in REQUIREMENTS.md; ROADMAP.md's Phase 14 Notes and Phase 15/16/17 dependency notes resolved against the retain decision; warp-over-resource_set todo answered on its fork-facing question (not moot, mark fork-only per SKILL-01); pending-todo count reduced 21->20 (22->21 total Deferred Items), not the DEBT-04 true close
- [Phase 15]: Widened docs-review-disposition.test.ts's parseFindingIds() regex to /^#{2,6} +(WR|IN|CR)-(\d+)(?![0-9])/gm -- discovers all 150 findings across every *-REVIEW.md (was 119); 03-REVIEW.md's 14 level-4 findings and 14-REVIEW.md's no-colon IN-01 were invisible to the old regex
- [Phase 15]: 14-REVIEW.md IN-01 closed via a new completed todo citing commit 69465e41c580a0bcbf97fc7e4b58cbfac6e368ac -- fixed in Phase 14 but never cited in a source docs-review-disposition.test.ts recognises
- [Phase 15]: 03-REVIEW.md's eight newly-surfaced findings filed as one pending todo owned by plan 15-04, with per-finding re-verification against current source correcting two of the plan's own stale verdicts (WR-08, IN-03 both confirmed STILL OPEN, not moot/superseded)
- [Phase 15]: WR-07's allowlist narrowing implemented exactly per 08-REVIEW.md's fix; documented that it does not catch a future stealth mention of a currently-unreferenced hardware/fork tool (architectural limit of the single-pass filter), not silently claimed closed. — Evidence-based disposition over an inflated 'fully fixed' claim, matching this plan's own prohibition against recording a finding fixed without proof.
- [Phase 15-debt-and-review-disposition]: WR-05 already fixed (commit 21a42cb); no new code needed, cited with the TS7016/allowJs:false reason the review's suggested import route was not taken — capability-registry.test.ts's synthetic-tool set was already derived mechanically from vice-proxy.ts before this plan ran
- [Phase 15-debt-and-review-disposition]: Plan 15-04 closed all eight of 03-REVIEW.md's newly-surfaced findings, re-verifying each against current source before touching anything. WR-06/IN-05/IN-06 fixed in stock-live.test.ts (commit aaaffce); IN-02/IN-04 fixed and WR-07/IN-03 re-verified-then-fixed in stock-registers.ts/.test.ts/vice-proxy.test.ts (commit e8621d7) — WR-07's false-negative class and IN-03's dead union member were confirmed still live by direct source inspection, contrary to the plan's own stale premise that both had superseded; WR-08 likewise confirmed STILL OPEN (README.md still said "three" against an actual eight, and still omitted VICE_LIVE_STOCK_BIN) and fixed rather than recorded superseded, since the plan's "moot" premise did not hold either. The pending todo this phase's 15-01 plan filed was moved to `.planning/todos/completed/` with a Resolution section citing all eight verdicts and commits; pending-todo count returns to 20 (see `### Pending Todos` above and `## Deferred Items` below)
- [Phase 15]: [Phase 15-04] WR-08 and IN-03 re-verified against current source and found STILL OPEN, contrary to the plan's own stale "moot"/"superseded" claims; both fixed for real (README.md manual-only count/env var, OPEN_SERVERS narrowed to Set<Server>) rather than dispositioned falsely. — Matches this plan's own must-have (never record a finding fixed/superseded without a landed fix or reproducible evidence) and 15-01's precedent of trusting direct source verification over inherited review claims.
- [Phase 15]: [Phase 15-04] registerCatalogFor() now caches the in-flight promise (not the resolved catalog) with rejection eviction, closing a real concurrent-duplicate-REGISTERS_AVAILABLE race; non-vacuity proven by two planted-revert probes. — IN-02's finding was real: two synchronous callers on a fresh session previously each saw an empty cache before either write landed, sending two wire requests.
- [Phase 15]: 15-08: closed 03-HUMAN-UAT.md scenarios 1/2 with live evidence against genuine stock VICE 3.9 -- scenario 1 pass (byte-comparison snapshot round trip), scenario 2 partial (keyboard pass, joystick zero-delta reproducing Phase 13 A3 under a proven-running program; no [ASSUMED] label touched) — DEBT-03 requires execution with evidence, not a claim; both scenarios were live-testable in this environment
- [Phase 15]: 02-REVIEW.md IN-05 fixed: stockReconnect() thrown message corrected to name itself, pinned by a derived where:-vs-message-prefix invariant test (commit 9849224)
- [Phase 15]: 09-REVIEW.md IN-01..IN-03 recorded wont-fix on evidence-immutability grounds (Phase 9's probe-harness transcripts back the milestone's degrade/R4 verdict); not one byte under Phase 09's directory changed
- [Phase 15]: 13-REVIEW.md WR-01 confirmed already fixed at commit f73d0fa (contrary to 15-RESEARCH.md's stale two-line-fix claim) and pinned mechanically via a readdirSync-derived sh -c interpolation gate; WR-02/IN-01 deferred with named reopen triggers; IN-02 promoted to plan 15-12 with a named owner
- [Phase 15]: Phase 15 plan 15-06 closed DEBT-02's items 1-2-3 (drive-type closing note, project-root prerequisite, RELEASES.json schema) in c64-ram-capture/SKILL.md, each grep-verified against the implementing module; three todos moved to completed/
- [Phase 15]: Phase 15 plan 15-07 fixed three cheap pending todos: build-atomic.test.ts's cleanup-scan flake (private wrapper dir, proven by planted violation, commit 7484afa), cpuhistory-get*/cpuhistory-get-multi.json's mislabelled fork-as-stock capturedFrom (commit d67f0ef, derive-the-kind follow-on named rather than fixed since it touches evidence-immutable probe-binmon.mjs), and the hand-copied ACME/regenerator2000 gate migration onto r2000-test-gate.ts across three files (commit 185187a), proven by a measured before/after pass-count table identical in every cell
- [Phase 15]: Phase 15 plan 15-09: GAINS-PROTOCOL.md's warp error codes corrected to the measured 2026-08-20 stock-3.10 values (0x01 object-does-not-exist, 0x8f only for int-typed set); vice_machine_config_set's WarpMode caveated fork-only in docs/stock-vice-parity.md and capability-registry.ts (existing fields, no schema growth); vice_ping's resolvedBinaryPath documented as a startup-time probe with a new backward-compatible resolvedBinaryPathScope field. Both pending todos closed; STATE.md ledger reconciled (pending 12->10, total 13->11).
- [Phase 15]: [Phase 15-10]: A4 (the D-11 rate-limiter's setImmediate() auto-disable deferral) live-tested against genuine stock VICE (KERNAL IRQ at $EA31, ~21 observed hits/sec) and CONFIRMED for the rates and host tested -- auto-disable fired, wire-side enabled flag independently confirmed false, emulator kept progressing; probe-debt todo closed with all five original assumptions accounted for
- [Phase 15]: [Phase 15-10]: 03-HUMAN-UAT.md's last pending scenario (scenario 3) closed pass, citing 15-A4-PROBE-EVIDENCE.md; file now carries zero result: [pending] rows, status stays partial (scenario 2's joystick half remains an honest negative result)
- [Phase 15]: [Phase 15-11] vice_disk_attach's approximation string and docs/stock-vice-parity.md's D-14 bullet both corrected to state the real reset-plus-load behaviour Phase 13's A5 probe observed; the plan's own claimed second disagreeing site at :311 was verified and found unrelated (a different D-14).
- [Phase 15]: [Phase 15-11] tools-manifest.json staleness todo disposed wont-fix on the D-16 ground (deliberate deletion, not staleness); fork-live.test.ts's live-surface diff now names D-16 explicitly via a new shared fork-deleted-tools.ts constant, never a second hand-typed list.
- [Phase 15]: [Phase 15-11] CI test-command divergence settled keep-npm-test from GitHub Actions run 32517575905's own log (all nine MANUAL_ONLY_TESTS suites pass cleanly in under two minutes); documented in ci.yml's Test-step comment citing the run id, naming zero manual-only test filenames.
- [Phase 15]: [Phase 15-11] vice_disk_attach's contract-redesign question promoted to REQUIREMENTS.md Future Requirements with plan 15-12 named as owner, not implemented here; REQUIREMENTS.md itself untouched by this plan.
- [Phase 15]: [Phase 15-12] Closed the phase's record: Phase 08's ten review findings (WR-04..WR-13) transcribed with resolvable commits into one Resolution table; broker-tests-stall and .vsf-bootstrap-input todos closed wont-fix; keyboard-fallback-load todo promoted with a named owner (plan 15-08's live evidence met neither of the two closing conditions this plan named); GATE-02/DEBT-01/DEBT-02/DEBT-03 flipped Complete with closure notes; pending-todo count reduced from 21 (as of 15-01) to 2, both remaining items promoted to Phase 16 (PKG-01, PKG-03)
- [Phase 15]: [Phase 15-01, restated by 15-12's phase-close] The widened guard's two new invariants: a shape-drift detector (declaredFindingIdsInHeadings(), anchored at any heading level 1-6, whose output must be a subset of the narrower parser's) so a future fifth heading shape fails a named test instead of silently vanishing; and a fixture-driven regression test (planted WR-98/IN-97 shapes in fixtures/planted-review-fixture.md) pinning the two previously-invisible shapes against a committed fixture
- [Phase 16]: Phase 16 plan 01: skills relocated to src/skills/; D-16-02 accepted losing in-repo autoload, documented two consumer routes in README.md; found and fixed 3 out-of-scope functional path literals (r2000-regbits-gen.ts MEMMAP_PATH family) that the plan's own consumer enumeration missed
- [Phase 16-packaging-and-repo-shape]: Accept broker control-plane 0.0.0.0 bind (PKG-04) rather than narrowing it — The bind exists so a containerised consumer dialing host.docker.internal can reach the broker; narrowing without a replacement route would be a regression. Compensating control: 256-bit token, timingSafeEqual, mode-0600 broker.json. Recorded in PROJECT.md Key Decisions with a named smart-default follow-on.
- [Phase 16]: 16-03: PKG-01 merge half verified rather than rebuilt -- wireMcp() already implemented correct merge semantics; added 18 node:test cases (in-process happy paths + subprocess-driven refusal paths via an entry-point dispatch guard) pinning it against the shipped cli.mjs, zero new dependencies — The pending todo's own Solution step 4 asked for exactly this test; a malformed-config refusal was the security research's named tampering mitigation and was previously unasserted
- [Phase 16]: Phase 16 plan 04: relocated the MCP server package (@henols/vice-mcp) from .claude/mcp/vice/ to src/mcp/vice/ in one atomic git mv; repoRoot()'s branch-4 hop count reviewed and left unchanged (same 3-segment depth); found and fixed 3 functional literals plus ~22 stale .claude/skills self-references that plan 16-01's own sweep missed; published tarball proven byte-identical to the pre-move baseline — PKG-01's second, larger half -- the same relocation machinery plan 16-01 proved on the skills tree, driven through the ~180-file vice-mcp package
- [Phase 16]: Phase 16 plan 16-06: PKG-02 closed -- all three previously-untested skill CLI scripts (acme.mjs, driver.mjs, derive.mjs) now have committed, discovered test coverage (47 new tests: 16+17+14); a driver.mjs .d.mts declaration file was tried and reverted after it leaked into the installer npm tarball, replaced with a scoped @ts-expect-error on the one import line instead; parseAddr()'s null-address branch confirmed unreachable through the shipped (unexported) surface, pinned to its nearest reachable observed proxy rather than invented or fixed by editing the script.
- [Phase 16]: PKG-03: comment-scoped orphaned-phase-pointer guard built; 15 sites + 2 test decision-id strings repointed at existing permanent records; fixture + gate-proof committed — Cut-phase citations must name the phase, not its number (re-tripping risk); matching is per-physical-line, not per-span, to avoid cross-line false positives measured in the real corpus
- [Phase 16]: Phase 16 plan 05: swept CLAUDE.md/README.md/docs/*.md path references to relocated src/ trees; re-verified all four vice-proxy.ts line citations unchanged; fixed a pre-existing acme-build Project Skills table description drift; left one 2026-08-12 command transcript in docs/phase1-probe-results.md untouched as historical record
- [Phase 16]: [Phase 16-08]: Leak assertions promoted into assertLeanTarball(), invoked from inside packFiles() so no packed package skips the check; the packed-package name set is pinned to exactly two names so a third package cannot be packed unchecked.
- [Phase 16]: [Phase 16-08]: ci-suite-coverage.test.ts fixed a self-inflicted regression in ci-guardrails.test.mjs (its npm-test-step assertion assumed exactly one such step existed repo-wide); scoped to working-directory: src/mcp/vice.
- [Phase 16]: [Phase 16-08]: Two pre-existing npm-test failures (docs-review-disposition.test.ts, audit-integrity.test.ts) tripping on 16-REVIEW.md's own undispositioned findings, confirmed via git stash to predate this plan; logged to deferred-items.md as out of scope, expected closure at 16-11.
- [Phase 16]: [Phase 16-09]: hop-chain-comments.test.ts built as a fixture-pinned, per-line structural guard against WR-02's defect class (a comment splicing a current path-chain segment onto pre-relocation intermediate segments); demonstrated RED against both real violations before fixing them. r2000-regbits.test.ts's two scratch-tree segment lists and .gitignore's canonical-source comment renamed to the current src/mcp/vice / src/skills shape (behaviour-neutral, proven by the drift guard's own unequal digests). SUMMARY deliberately avoids naming 16-REVIEW.md's OTHER open finding by its literal id token, since docs-review-disposition.test.ts's disposition check is a bare-word presence scan that would otherwise falsely close it -- that finding stays open, owned by plan 16-10.
- [Phase 16]: 16-10: Reverted CR-01 consumer-path regression (renderLedger/anchor-search/renderLoading/template.a/SKILL.md), shipped skill-consumer-paths.test.ts as a frozen four-entry registry guard against the class recurring; docs-review-disposition.test.ts and audit-integrity.test.ts confirmed fully green (2386/2342/0/39/5) for the first time this phase
- [Phase 16]: [Phase 16-11]: PKG-04 flipped to checked/Complete in REQUIREMENTS.md with a closure note citing PROJECT.md's dated accepted-risk row and 16-PKG04-EVIDENCE.md, explicitly preserving the open Control-Plane Bind Follow-on; PKG-01 given a companion closure note naming plans 16-08/16-10
- [Phase 16]: [Phase 16-11]: New decision register 16-GAP-CLOSURE-DECISIONS.md records five deliberate non-reversals with owners/reversal triggers (four SKILL.md quick-references, recovery-schema.mjs, project-paths.mjs, repo-root.test.ts, and 16-REVIEW.md's IN-01 recorded as renamed-not-left by plan 16-09), the spec-less probe's four-item accounting (two authored, two flagged unresolved), the three recalled prohibitions, and five newly-found sites with their closing plans
- [Phase 17]: Dropped docs-deferred-ledger.test.ts's non-vacuity pending floor to no floor at all (not a smaller nonzero number), since 0 pending is DEBT-04's own success criterion, and made the positive control conditional on pending.length > 0 (selecting its stem from the live pending array instead of a hard-coded filename) — The previous floor of 2 could not express a genuinely empty pending tree; the guard's own prior-author comment named this exact phase as the one that might need to lower it further
- [Phase 17]: STATE.md's Deferred Items ledger now reads the true v0.4.0-close count of 0, derived from and agreeing with the empty .planning/todos/pending/ tree — Phase 16 discharged both remaining pending todos (PKG-01, PKG-03); the ledger text was stale by exactly those two rows until this plan's Task 2
- [Phase 17]: CORE-01 decided keep-dated at plan 17-02 task 1's blocking-human checkpoint, delegated by the human to the orchestrator, recorded in PROJECT.md → Core Value dated 2026-08-23 — The checkpoint was rendered and the operator answered 298 seconds later in free text `you decide` rather than selecting an option; attendance and delegation are on the record, comprehension is not evidenced by any artifact and is not claimed (corrected 2026-08-23 by plan 17-04, gap G-17-1); orchestrator selected keep-dated on R2000-01's structural VICE-incapability argument and v0.4.0's lack of new evidence
- [Quick 260823-kf6]: Flipped QUAL-01/QUAL-02/QUAL-03 to Closed in STATE.md's carried-forward ledger, naming PKG-02/PKG-03/PKG-04; reconciled STATE.md's Deferred Items prose and REQUIREMENTS.md's DEBT-04 note to the one genuinely surviving open row (UP-01/UP-02) — corrects v0.4.0-MILESTONE-AUDIT.md round-1 tech-debt cluster 1
- Roadmap (v0.5.0): the coverage instrument (Phase 19) and the reassembly-plus-hazard-report gate (Phase 21) are both sequenced before the work they measure (Phase 20's decomposition sweep, Phase 22's equivalence/modifiability demo respectively) — mirroring v0.4.0's audit-gate-first precedent (Phase 12). EQUIV-01 (compare.mjs's original-vs-different-binary extension) is flagged as the milestone's single highest-risk requirement and sequenced as Phase 22's first success criterion rather than split into its own phase.
- [Phase 18]: 18-01: Ran the Architecture Change Procedure's six steps for the D-17/D-18 reversal in ARCHITECTURE.md; allocated D-36 superseding D-32; pinned both with docs-r2000-decisions.test.ts, proven non-vacuous by three live planted-violation probes
- [Phase 18]: ensureProjectSettings() shares R2000_SYSTEM_C64 with synthesizeProject() (D18-33); forces use_illegal_opcodes silently but refuses by name on a settings.system mismatch (D18-34).
- [Phase 18]: [Phase 18-03]: Promoted openR2000Session()/R2000Session (r2000-mcp-client.ts) and built r2000-session.ts's single-slot lifecycle owner; runR2000Tool() rewired through runInR2000Session() with its call-then-save body byte-identical; D18-09's three-scenario save-discipline gate landed live and watched red-then-green against real production code — While proving this plan's own npm test full-suite acceptance criterion, found and fixed a real cross-session staleness bug: a held session could answer from stale in-memory state after r2000-symbols.ts's importLabels() (a deliberately separate one-shot session per D18-07) saved to the same project file -- fixed via a project-file mtimeMs comparison before every reuse. Also diagnosed (but did not fix, per scope-boundary) a pre-existing, unrelated npm test hang affecting r2000-cli.test.ts and three siblings when regenerator2000 is installed locally -- logged to deferred-items.md and WINDOWS.md.
- [Phase 18]: SESS-02 restart policy: crash counter is scoped per project path, resets only on explicit test reset or project-path change (never on success), bounded by DEFAULT_R2000_RESTART_BUDGET=3 (env-overridable via R2000_RESTART_BUDGET)
- [Phase 18]: D18-23 (SIGKILLed-proxy orphan risk) answered by measurement: regenerator2000 0.9.20 self-terminates within ~200ms of stdin EOF with no exit hook running -- no startup sweep filed
- [Phase 19]: Phase 19 elects MIT from regenerator2000's dual MIT OR Apache-2.0 for all absorbed prose; the Apache-2.0 modification notice is discharged by each per-file ADAPTED, NOT VERBATIM header regardless
- [Phase 19]: D18-16 CLOSED by measurement: regenerator2000 0.9.20's --mcp-server-stdio does not multiplex (3 runs + source proof), so the coarse FIFO mutex stays and a reader-writer upgrade would buy zero parallelism
- [Phase 19]: Census assertions in packaging CI are relations against src/skills/, never literals — check-npm-packages.mjs now compares tarball skill count to topLevelSkillDirs() with a >=6 non-vacuity floor
- [Phase 19]: All five upstream analyze procedures are now absorbed, so ABS-01 and ABS-02 flip to Complete, reversing 19-01's deliberate rollback
- [Phase 19]: One attribution block per SOURCE PATH, not per file: c64-memory-mapping and c64-program-recon each absorb two procedures with two different digests, and a single per-file header could only claim one of them
- [Phase 19]: The bare disasm token is banned corpus-wide by check-skill-fork-honesty.mjs (a removed acme verb) with its exemption count pinned at exactly 1, so absorbed read-region steps omit the view parameter and rely on its documented default rather than growing the exemption
- [Phase 19]: Coverage report schema pinned as flat sibling measure objects (checkpoint option flat-three, auto-selected under yolo mode): each measure addressable by a stable top-level key, schema test is a plain key-set assertion, and no aggregate is one reduce away — COVERAGE_SCHEMA_VERSION = 1 with nine top-level keys is the contract Phase 20 reads throughout its sweep and Phase 21 reuses for its hazard report; a rename must bump the version deliberately
- [Phase 19]: COV-01 reproducibility uses a bytes-versus-store independence axis, not a second agent session — Nested headless agent sessions stall indefinitely in this environment, so the runnable independence is that neither route reads the other route input; the committed sha256 seal is what prevents retrofit, and a live test recomputes both routes from the fixture on every run
- [Phase 19]: The census reads regenerator2000 own block table at exactly one call site, the divergence sub-report, and never as a measure of completeness — Upstream follow_indirect_jumps walks only bytes already classified Code through pointers already classified Address, so on an under-classified binary it finds nothing; a store-derived census would report nothing-left-to-do on an untouched binary
- [Phase 19]: The coverage verb reuses runR2000Tool() rather than opening its own session: reads share the one held regenerator2000 child, and the curated-tool assertion plus resolveStorePath() stay on the path. No new child-process site (T-19-25).
- [Phase 19]: Coverage exits 0 for any report it could build, however poor the numbers; non-zero is reserved for a caller error, an unreadable store, or an undecodable payload. A bad score is a result, not a failure.
- [Phase 19]: Cross-reference lookups are bounded at 512 non-System labels and the bound's effect is PRINTED whenever it bites, so a partial population never reports as the whole one (COV-02).
- [Phase 19]: Packer identity ships as a project-owned skill script, never an r2000_-prefixed tool: that prefix asserts regenerator2000 serves it, and no such tool exists upstream at the pin.
- [Phase 19]: The packer name has exactly one assignment site in the module, inside the external-oracle branch; the high confidence level likewise. Both counts are asserted at source level by the colocated test.
- [Phase 19]: An absent packer oracle is a VISIBLE skip by default and a hard failure under VICE_REQUIRE_UNP64 (demonstrated: exit 1). Absence never reads as a passing SURF-03.
- [Phase 19]: An eighth r2000 CLI verb moves FOUR counts, not three: the dispatch switch, R2000_CLI_VERB_FLOOR, REAL_VERBS, and r2000-cli.test.ts's VERB_OPTIONS length assertion. All four now carry comments saying so.
- [Phase 19]: ABS-03 closed on a gate green over SHARPENED descriptions, not a weakened one: threshold untouched, allowlist empty, no skill excluded; observed inventory maximum 0.250 against an inclusive 0.35
- [Phase 19]: The absorbed procedures are a SNAPSHOT at commit 493f8404 (53,392 bytes, five paths); re-sync is a hash comparison mechanised by the manifest's resync_triggers, triggered by any move off regenerator2000 0.9.20 or any change to r2000_get_binary_info's field set
- [Phase 19]: r2000_toggle_splitter (DECOMP-01, BUILD-02) and r2000_set_immediate_format (IS BUILD-03) are PROPOSED in Phase 19 and implemented at the start of Phase 20 -- the absorption diff acted as a requirements-discovery instrument
- [Phase 19]: SURF-03 closes on a NEGATIVE result stated as one: the bar is a project-owned route that never guesses, not a name reported on this machine; upstream's signature table deliberately not copied and no invented name placed on the r2000_ prefix
- [Phase 19]: D18-16's reader-writer deferral is CLOSED by measurement -- the child reads serially, so the coarse FIFO mutex is an exact model rather than a compromise; the r2000-tools.ts cursor-tool invitation is answered in the same decision and the trio stays held
- [Phase 19]: A new blocking CI gate is wired into ci.yml in the same commit that creates it and held there by ci-guardrails.test.mjs's frozen list -- a guard script CI does not run is a file, not a control
- [Phase 19]: 19-06: the multi-caller cross-reference rule matches a DELIMITED token, never a substring — a caller's hex needs a non-hex-digit right boundary at the bare or canonical-4 width, and a caller's label name needs an identifier boundary both sides — An unanchored includes() let a mention of the unrelated address $8106 rescue NC4's undocumented $0820 label, producing a fully clean verdict with zero findings on the one measure whose whole subject is resisting being gamed (T-19-14).
- [Phase 19]: 19-06: every count in the coverage report is derived from the deduped list printed beside it (WR-02) — coverageFindings() prints a count and an address list in one sentence; a pre-dedup count beside a post-dedup list made the finding text contradict itself (2 label name(s) ... at $1000).
- [Phase 19]: 19-07: MIT election and corrected notices wording APPROVED by human (option id approve-wording-release-on-reverification). Release hold REMAINS; the named condition that lifts it is: "Phase 19 re-verification returns no gaps."
- [Phase 19]: 19-07: INCORPORATION_CLAIM_PATTERN is independent of the notice section — keying the claim on its own discharge would make the presence guard tautological.
- [Phase 19]: Checkpoint decision: report shape narrow-and-add-sibling — discoveredTargets narrowed to proven-only, splitTableCandidates added as advisory sibling (19-08)
- [Phase 19]: COVERAGE_SCHEMA_VERSION bumped 1 -> 2; nine-entry COVERAGE_REPORT_KEYS top-level set unchanged (19-08)
- [Phase 19]: A proven class-3 split table additionally requires a lo/hi orientation resolved by its own store construction; otherwise it is advisory (19-08, WR-01)
- [Phase 19]: 19-09: the false-positive census control pair writes its 57 data bytes out in full in BOTH literals rather than sharing a constant, so the identical-tail invariant is a real check an edit can break rather than one true by construction. Both plantable invariants were demonstrated throwing. — A shared data constant would make the 'differing ONLY in addressing mode' invariant vacuously true, reproducing in the generator the exact defect class the gap closure exists to remove.
- [Phase 19]: CR-02's disposition was filed in the AUDIT-01 guard's source 3 (.planning/todos/completed/), not in a SUMMARY or in 19-REVIEW-FIX.md — Source 1 arrives only at plan close, after this plan's own verification must observe the guard green; source 5 is plan 19-13's deliverable and writing it here would put two plans on one file. Filed under completed/ rather than pending/ because CR-02 is disposed, not deferred: a pending todo would need a matching STATE.md Deferred Items row or docs-deferred-ledger direction A turns red.
- [Phase 19]: A wave-1 disposition names in-flight work as outstanding: CR-04 is recorded as OUTSTANDING with plan 19-10 named, never as fixed — 19-10 had produced no SUMMARY and no commit at this record's date. Every hash written into the record (1706d8b, 9c9166d) was resolved with git cat-file -t first, so the record cites only what already landed. A disposition that predicts a commit is not a record.
- [Phase 19]: CR-04 recorded FIXED, not accepted: hasDispatchContext() now requires the dispatch CONSUMER — the bare-0x6c-within-reach branch is REMOVED, and a zero-page vector counts only when an indirect jump in reach names the LOWER of two store targets differing by exactly one. — An indirect jump through some OTHER vector near two indexed loads is not evidence that those loads feed it. The only positive class-3 assertion (SPLIT_TABLE) survives on the stricter rule because its jmp indirect operand equals its own sta target.
- [Phase 19]: A negative control must reach the INTERIOR of the predicate it constrains, and the declaration is checked mechanically — DISPATCH_CONTEXT_SHAPES plus reachesGateInterior() and GATE_INTERIOR_DECLARATIONS, with the declared shape count asserted against the predicate own source text. — Every negative control 19-08 shipped bracketed the gate from the OUTSIDE, which is why a 2517-passing suite concealed CR-04. The witness THROWS on an unknown shape id so minting one without an interior predicate is a test failure rather than a vacuous pass.
- [Phase 19]: WR-14 dispositioned fixed-and-cited: the class-4 stack-return scan is gated to class 3's standard (same index register, plus every published entry point in-image and decodable) rather than deleted or demoted to advisory — The idiom is real and its push-order lo/hi justification is sound, so the defect was the missing gate. Class 4 fed the same provenDispatchTargets() seam class 3 feeds while satisfying none of its five conditions -- gating one half of a seam is not a gate.
- [Phase 19]: WR-15 dispositioned fixed-and-cited: only a PROVEN class-3 pairing consumes its leading load; an advisory recording remembers its first candidate and keeps scanning the window — One unrelated indexed load between the two halves of a real split table turned proven 1 / advisory 0 / proven targets 8 into proven 0 / advisory 2 / proven targets 0, reported as a clean-looking empty splitTables. The direction is safe (under-report) but silent, which is the one thing a coverage instrument may not be.
- [Phase 19]: The class-4 interior witness is register-agnostic, and GATE_INTERIOR_DECLARATIONS rows now carry an explicit polarity whose negative subset alone satisfies a shape's need for an interior control — Requiring the register match inside the interior predicate would put the mismatched-register control outside the very predicate it constrains -- CR-04's exact defect. And letting the two new interior POSITIVE controls count toward shape coverage would displace 19-10's rule that every sufficient shape owes the suite a negative control reaching inside it.
- [Phase 19]: WR-13 fixed by demanding a reference in the multi-caller name branch (backticked, caller-naming word, or parenthesised hex), not by removing the name branch — Removing the name branch and accepting only the hex form was weighed and rejected: it would silently reclassify every project whose annotator cites callers by name, turning a documentation-quality measure into a citation-style measure. The decision and the residual are recorded beside the rule.
- [Phase 19]: IN-05 fixed by one derived effectiveEnd = min(origin+size, 0x10000) in scanIndirectDispatch(), read by all five sites that previously recomputed origin-plus-length — The census was clamped by IN-04 and its own dispatch sub-report was not, so one report described two address spaces. Stating the bound once is this repository single-seam-per-concern pattern applied at function scope; the review named four sites, there are five (19-11 isPlausibleEntryPoint is the fifth).
- [Phase 19]: Phase 19 review dispositions live in 19-REVIEW-FIX.md, the durable ledger — all 24 finding ids, CR-04 recorded FIXED rather than accepted
- [Phase 19]: A disposition ledger must cover its full id set ALONE, with every other source excluded — measured by replaying the guard predicate per source set, not asserted
- [Phase 19]: REQUIREMENTS.md stays unwritten by the run that fixed the defect — 19-13 declined the workflow automatic requirements.mark-complete step, the third consecutive plan to do so
- [Phase 19]: A green gate does not close an intermittent failure — the r2000-session 200ms stub flake stays open at 2 red in 6 full-suite runs, owner a plan that owns r2000-session.ts
- [Phase 19]: hasDispatchContext() branch A is decided against the pairing under test, not against shapes in the window — A branch that never consults the two loads it is ruling on cannot say anything about them; the pairing now crosses the call boundary as a DispatchPairing (19-CONTEXT.md D-02, D-03).
- [Phase 19]: The falsified class-4-claims-the-window rationale was replaced rather than annotated — Leaving a falsified justification beside its correction preserves the reasoning that produced the defect; class 4 claims only its exact five-instruction shape.
- [Phase 19]: A tightening ships in the same commit as a liveness positive control — A branch that can never return true is dead code wearing a sufficient-shape label -- a worse defect than the loose branch it replaced, and invisible in a green suite.
- [Phase 19]: hasDispatchContext() branch B compares the indirect jump against `pairing.oriented.vectorLow` — the vector the pairing itself built through its own two consumer stores — so a jump through an unrelated consecutive zero-page pair in the same window no longer proves a split table — The vector address rides `SplitOrientation` rather than being re-derived: it comes out of the same two consumer stores that decided the lo/hi roles, so orientation and vector cannot disagree
- [Phase 19]: D-02 is enforced by a source-derived pin that extracts every `return true` site in the body of hasDispatchContext() and asserts that each site DEPTH-1 guard chain names the `pairing` parameter — Every other guard around this gate is satisfiable by the same author who writes a loose branch; a pin that reads the body of the predicate is not. Watched fail against the presence-only form of both branches
- [Phase 19]: The dispatch instrument's per-shape controls are joined by a corpus-wide PROPERTY: 1000 composed 6502 arrangements plus 1000 immediate twins, whose expected verdict is COMPUTED by a six-rule oracle over the symbolic fragment list, with one set equality asserting in both directions that the instrument proves exactly what carries a proven data-flow link — Three consecutive rounds each closed by one hand-built fixture for the shape just found, so the suite always trailed the next shape by a round. A per-shape control cannot be written for a shape nobody has thought of, at any N.
- [Phase 19]: A generative sampler's axes are drawn by a 32-bit avalanche mix seeded per family, never by a linear rotation of the sample index — Measured twice: any rotate-then-scale scheme maps an arithmetic progression on the sample index to one on the axis, and the stratum index IS such a progression, so the ORDER axis stayed locked to a stride on the terminator axis and one of the two branches under demonstration lost its whole generated coverage whichever ordering was chosen.
- [Phase 19]: A control target is a (shape, route) pair, not a shape: reachesGateInterior() takes the route and the class-4/class-3 disjunction is deleted — Round 3 shipped a mechanism built to catch exactly this defect class, and it passed over the defect: one shape is ruled on by two gates and the witness ORed them, so all three of that shape's declared negative controls satisfied only the class-4 half and the class-3 route had no control at all.
- [Phase 19]: Reachability on a route that consults the shared gate is DERIVED and asserted, never hand-declared — Otherwise the cheapest way to satisfy the coverage assertion is to mark a reachable pair unreachable instead of writing a control for it. Flipping one was demonstrated to red three independent checks.
- [Phase 19]: A route's verdict is measured through the collection that route publishes into, never through the aggregate provenDispatchTargets() seam — STACK_RETURN is a class-3 decline and a class-4 acceptance in one payload. Through the seam it reads as accepted and the decline is inexpressible; through splitTables and stackReturnDispatch both facts are legible.
- [Phase 19]: The recursive descent stops at an illegal opcode; the census's three readers (descent, linear sweep, isPlausibleEntryPoint) are brought to ONE predicate, isDecodableAsInstruction() — The descent walked through illegal opcodes and claimed their bytes while the sweep beside it refused them: a 64-byte image with four bytes of code reported reachedAsInstruction=64 against linearSweepDecodable=4. Two readers already agreed on the stricter rule; the third never asked.
- [Phase 19]: The descent moved to the sweep's standard and NOT the reverse; COVERAGE_SCHEMA_VERSION stays 2 — Loosening the sweep to walk stable undocumented opcodes would redefine what linearSweepDecodable MEANS in a report Phase 20 consumes, which owes a schema bump and a consumer review. Residual accepted and sized: 105 of 256 opcode entries are flagged illegal, only 12 of them jam, so 93 stable undocumented instructions will now stop a census and under-report it. Reversal condition named in 19-DECISIONS.md Decision 6.
- [Phase 19]: 19-19: The round-4 consolidation states its 15-demonstration total as DERIVED by counting the planted-violation rows the five SUMMARYs record (1+3+2+6+3), and invites the recount; three cells carry a named absence rather than a plausible number, because the pairing-consultation pin, the four route pins and the declaration half of the (shape x route) assertion have no report values by construction
- [Phase 19]: 19-19: WR-03 recorded CLOSED in deferred-items.md with its before/after measurements (64/0/4 to 4/60/4, the $ea twin unchanged at 64/0/64), the orchestrator authority that superseded 19-CONTEXT.md's deferral, the deliberate decision to leave 19-CONTEXT.md byte-unchanged, and the residual sized at 93 stable undocumented opcodes now under-reported by BOTH figures instead of contradicted by them
- [Phase 19]: 19-19: D-08 recorded as a contingency and NOT acted on -- if round-4 verification returns SC4 partial again the next action is to rescope SC4 to advisory-not-gate rather than run a round 5, but that edit is ONE-WAY (a ROADMAP success criterion plus a REQUIREMENTS entry Phase 20's entry conditions read) and requires explicit user confirmation; no checkbox, criterion or requirements entry was touched
- [Phase 23]: Phase 23 gate pre-committed sight-unseen: R1..R9 first-match-wins with thresholds 10.00/50.00/0/0 under an exact-at-threshold contract, and 68 outcome-line names frozen before any measurement exists — Operator answered `proceed` at the 23-01 Task 1 blocking-human gate. git log is the only proof PROOF-05 has, and it is one-way: once any measurement commit lands the rules can never again be shown to predate it
- [Phase 23]: The corpus is modelled as corpus.releases[] with exactly one canonical: true, superseding the scalar corpus.file_sha256 / corpus.capture_sha256 phrasing in 23-RESEARCH.md Pattern 2 and 23-VALIDATION.md — Two independently-cracked releases are available, so the scalar keys have no single correct value; bolting a _secondary key alongside would reproduce the canonical-image-centric model recovery-schema.mjs exists to prevent. The one-release case is the degenerate single-element list
- [Phase 23]: PROOF-05 ordering is asserted over evidence/ only, never over the phase directory — The phase directory already carries the CONTEXT, RESEARCH, VALIDATION and PLAN commits made before execution began, so a primacy check scoped to it can only ever name the context commit and is unsatisfiable by construction
- [Phase 23]: The 279-byte fixture's published 141-code / 138-data ground truth is NOT source-derivable: re-deriving it byte by byte from acme's own report gives 145 code / 131 data / 3 assembler-pad, so FIXTURE_REPRODUCED is `no` and the baseline is the source-derived 72.39% recovery / 3 false positives / 27.61% false negatives — The four-byte reclassification that reproduces all four published figures exactly ($0869-$086b, the second `jsr print` dxa typed as data, and $08a6, the self-modified operand cell) was FITTED and is recorded as a hypothesis, not as the baseline. The direction of the divergence matters: the pivot's ground truth counts three bytes dxa got wrong as data, which is exactly what produces its headline 0-false-positive claim, so D-11's side-by-side against the corpus's inventory-derived numbers is not apples-to-apples. 23-10 needs an operator ruling on which figures D-11 prints.
- [Phase 23]: Where 23-02-PLAN.md and the frozen SCHEMA.md disagree on an outcome-line value domain, SCHEMA.md wins and the plan's own verify is recorded failing rather than repaired — Four divergences resolved as ACCEPTED LIMITs in evidence/fixture/fixture-baseline.txt: DXA_TARBALL_SHA256_VERIFIED reads `yes` not `pass`; FIXTURE_REPRODUCED reads `no` not `fail`; both percentage lines carry the full `<decimal> (<num>/<den>)` shape; and evidence/tools/TOOLS.txt is written as SCHEMA.md's declared outcome-line home alongside the plan-named transcripts. Both the failing as-planned check and the SCHEMA-domain-substituted one are committed as runnable files under evidence/tools/verify/.
- [Phase 23]: Criterion 4 records C4_UNREPLACED_CAPABILITIES: 0 — no analyzer.rs capability is both unreplaced and depended on, so rule R8 does not fire — The zero was reported adversarially: the audit names E6 follow_indirect_jumps as the single row whose reclassification would move the count, and the two conditions that would justify it, so a non-firing rule input is auditable rather than merely banked
- [Phase 23]: BlockType::HiLoAddress is lost-accepted, not replaced-by — the pivot fixture had no HiLo table, so the CONCAT11 observation covers the LoHi byte order only — This plan forbids a replaced-by disposition on the strength of a plausible feature name; the mirrored case is likely but unobserved, and the uncertainty is stated in the cost instead
- [Phase 23]: Ghidra CONCAT11 is ruled NOT sufficient for STORE-01 per-range typing of split pointer tables — Phase 25 must carry the range as declared store state with a byte-order flag — Observed: the contiguous table got a range type (08b7 pointer[4] len=8) while the split arrays got 08ad/08b0 undefined1 len=1 — one byte each, no extent, pair count or stride; the decompiler reports a per-use-site expression, not a range
- [Phase 23]: 23-03: C0_CORPUS is `partial`, not `pass` — no flat 64K capture was assembled and neither release's two runs compare as equivalent, so rule R1 fires and the phase verdict is no-go. — Three of the aggregation rule's five conjuncts fail: CAPTURE_SHA256 and CAPTURE_SIZE are could-not-run for both releases, and CAPTURE_EQUIVALENT is `no` for both. `could-not-run` does not apply — the emulator WAS driven to the handoff four times. This is the pre-committed rule doing what it was written for, five plans before the measurement existed.
- [Phase 23]: 23-03: the fork's stopping exec checkpoint is neither instruction-exact nor frame-exact — it reports the hit but pauses about a frame of work later, at a wall-clock-determined instruction, and can straddle a frame boundary. — Measured, not inferred: danish's two runs stopped at hit_count 1 and 2 (different frames) and diverge at 100 non-volatile multi-bit addresses; saeger's both stopped at hit_count 1 (same frame) and diverge at exactly one, $00F6. vice_run_until inherits the same mechanism and vice_execution_step advances nothing observable, so no precise-stop primitive is reachable from this surface. Any later plan needing a reproducible capture must solve this first.
- [Phase 23]: 23-03: re-emitting a 64K capture as hex through the agent is not reliable — one oversized write truncated mid-payload and one in-size write silently dropped 10 characters, caught only by an explicit length assertion. — c64-ram-capture names this as the only route, because the MCP surface returns text and the agent must re-emit every byte it fetched. Nothing available catches a substituted character, and four 64K images are 32-64 such writes; one undetected substitution would put a wrong byte into the substrate every later criterion is measured on. Recording the gap was judged strictly better than shipping an unverifiable substrate.
- [Phase 23]: Phase 23 verdict recorded: **no-go**, rule **R1** fired (input `C0_CORPUS: partial`). Full derivation, the rule reproduced verbatim, all five criteria and the collected limits/corrections live in one place: `docs/phase23-real-release-gate-findings.md` (frontmatter `verdict`/`verdict_rule_applied`/`criteria`) — read there, not restated here.
- [Phase 23]: R1 is the FIRST rule under first-match-wins, so the derivation reads one input and stops. No earlier-rule walk exists to show, and the six unevaluated inputs (five with no evidence file, because 23-05..23-09 were deliberately not dispatched for want of a depacked capture, D-03) cannot flatter the verdict because the derivation never reads them.
- [Phase 23]: No override was taken, and `corpus.releases[].capture_sha256` is written `could-not-run` rather than a fabricated 64-hex value — so 23-10-PLAN.md Task 1 own verify is recorded as unsatisfiable, following the operator-confirmed phase-wide precedent that SCHEMA.md and the facts win over a plan regex.
- [Phase 23]: 23-11: the verdict is bound into the tracking artifacts as a **pointer, never a copy**: `verdict: no-go`, `verdict_rule_applied: R1`, fired by the single input `C0_CORPUS: partial`, read at `docs/phase23-real-release-gate-findings.md` — that document's frontmatter is the single source of truth for every criterion value and none is restated here. The finding is qualified by the corpus it was measured against: two independently-cracked Bruce Lee (Datasoft, 1984) releases, canonical `danish` (`file_sha256` `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`, `capture_sha256` **`could-not-run`** — no flat 64K capture was ever assembled) and `saeger` (`file_sha256` `b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5`, `capture_sha256` **`could-not-run`**), neither image committed; and by the instrument pins dxa `0.1.5` (tarball sha256 `8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`), Ghidra `12.1.3 PUBLIC` build 2026-Aug-17, and the **fork** VICE backend `3.10`. — A second copy of the outcome values is a second thing that can drift out of agreement with the first; the pointer says where to read them, not what they are. Phase 24's ROADMAP `**Depends on**` line and Notes name the file and the `verdict` field literally, which — with D-08 having declined a test guard deliberately — is the entire enforcement mechanism for the gate.
- [Phase 23]: 23-11: `R1` carries **no pre-mapped per-requirement narrowing**, so no `DXA-*`, `GHID-*`, `OPC-*`, `STORE-*`, `CUT-*` or `AUTO-*` requirement is narrowed by name — the pre-mapped narrowings belong to `R6` and `R7`, and under first-match-wins neither was ever evaluated. The consequence written beside Phases 24, 25 and 26 is `R1`'s own text, reproduced rather than re-authored, and every downstream success criterion is left **byte-identical**. — `AUTO-04`/`AUTO-05` are therefore **unvalidated rather than narrowed**: `PROOF-03`'s criterion was never measured, so nothing was observed about where a single forward-carried `$01` value stops being correct, in either direction. Recording a narrowing that no fired rule authorises would be scope drift dressed as a verdict.
- [Phase 23]: 23-11: PROOF-01, PROOF-02 and PROOF-03 are recorded **NOT met** in REQUIREMENTS.md — not `Complete` — with the reason on the row; only PROOF-04 (criterion 4, whose recorded outcome is at `evidence/criterion4-analyzer-audit.md` and which needed no capture because the audit ran offline against crate source) and PROOF-05 (the machine-readable verdict derived from the pre-committed rule) are honestly discharged. — 23-11-PLAN.md asked for all five to flip; that instruction was written before the verdict existed and assumed the criteria had been measured. They were not: PROOF-01/02/03 each require the depacked flat-64K capture and the criteria measured on it, and no capture exists. Flipping them would make the traceability table assert a measurement that was never taken, which is the one thing a traceability table exists to prevent. 23-10 had already, correctly, left the file untouched when `requirements.ready-ids` returned 0/5 ready.
- [Phase 23]: 23-11: the remaining obstacle to a real measurement is **one** thing, not two — the fork's stopping exec checkpoint is not frame-exact. Snapshot-to-snapshot, with no transcription anywhere, the two `danish` runs still diverge at 201 multi-bit addresses. The hex-transcription half is **solved** (extract the 64K from a VICE `.vsf` `C64MEM` module body; validated against 23-03's own transcript, todo `2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`) and it **did not change the verdict** and must not be read as though it did. — A frame-exact stop is the single gate on `R1`'s "secure a corpus first" branch, so the re-scope decision can be taken on evidence rather than re-derived. The second pending todo (`back-05-test-fails-deterministically-on-a-live-broker-host`) is a test-isolation defect, unrelated to the verdict.
- [Phase 27]: The ACME availability gate stands under its own name in src/mcp/vice/acme-gate.ts with NO re-export shim in the module it left — A shim would leave the prefix-deletion hazard fully intact (a prefix-driven deletion would still break four test files), which is the exact failure SEAM-01 exists to remove.
- [Phase 27]: ACME_BIN and VICE_REQUIRE_ACME keep byte-identical names, so .github/workflows/ci.yml needed no edit at all — Audited line by line: ci.yml contains no ACME_BIN occurrence, and VICE_REQUIRE_ACME sits at :140 above run: npm test at :141. It binds env-var names only, never a module path. Renaming either var would convert CI's hard FAIL into a silent SKIP with a green run either way.
- [Phase 27]: The ACME hard-FAIL is proven by a child-process observation paired with a non-vacuity control, and NODE_TEST_CONTEXT must be deleted from that child's environment — ACME_AVAILABLE is a module-load const, so no in-process test can re-probe it. Measured during execution: an inherited NODE_TEST_CONTEXT makes a child node --test skip every file and exit ZERO, which would have shipped a green, vacuous gate — the precise defect class SEAM-01 targets.
- [Phase 27]: The annotation store block vocabulary lives behind one module (block-class.ts), never behind an argument: a later phase swaps the module, and the census never learns a store spelling
- [Phase 27]: A store-substitution seam is proven by SUBSTITUTION, not by a string grep: a second, zero-overlap block vocabulary through the boundary holds every census byte count while moving only the divergence sub-report, and the structural literal-absence check is committed as a labelled supplement
- [Phase 27]: The confidence grades are a SECOND, unmoved store surface: classFromStore() answers from the grade token and returns before consulting the block class, so on a fully-graded store the block vocabulary is not on the answering path at all. SEAM-03 moved one of the two surfaces
- [Phase 27]: Injection loudness is placed by scope: the classifier is required with no default on internal shapes (an omission is a typecheck error, observed at five call sites) and optional-defaulting-to-the-real-adapter at the public entry, so a forgetful production caller gets correct behaviour rather than a raw store vocabulary
- [Phase 27]: OQ-3 resolved as MOVE decodeRawData into prg-image.ts rather than record-and-defer — The coverage census statically imported it from a module a prefix deletion removes, so deferring would leave a criterion-2 capability one deletion away from silently breaking -- the exact failure SEAM-02 exists to prevent. Cost: one node:zlib import on the new module and two extra repoints.
- [Phase 27]: No re-export shim left in r2000-project.ts, and the six remaining importers were repointed in the extraction commit itself — A shim leaves the coupling fully intact while looking finished. And because tsc --noEmit is whole-project (tsconfig include is **/*.ts), any commit that removes the exports without repointing every importer is a tree that does not typecheck -- itself a partial repoint. Deviation Rule 3.
- [Phase 27]: r2000-cli.test.ts deliberately left untouched: measured, no comment in it attributes either moved function to the old module — The plan expected two comment-accuracy files. All seven parser mentions in r2000-cli.test.ts either name the function bare or attribute it to r2000-cli.ts own header, so editing it would be churn against correct prose. One comment-accuracy file (r2000-d64.ts), and six files needing no change rather than five.
- [Phase 27]: shippedTsModules() throws its own named ShippedFilesEntryMissingError instead of taking a caller's assertion library — No call site can opt out of the existence check by forgetting an argument, and all 11 call sites needed no signature change.
- [Phase 27]: codeOnly() was merged as a superset (state machine plus keepLiteralBodies), not a choice between the two divergent copies — The default false path stays byte-identical to the moved original, so the spawn-seam guard's semantics are unchanged, while prg-image's import-specifier caller keeps the literal bodies it must read.
- [Phase 27]: The comment-extractor family stays deliberately split, with all six sites named by filename and line inside shipped-modules.ts — Blanking string bodies would make the literals five of them search for unobservable; r2000-tools.test.ts:193-201 states that reasoning in code.
- [Phase 27]: The capability-or-glue record is a typed const with an enumerating guard (module-classification.ts), and its non-vacuity threshold is DERIVED from the registry rather than pinned or written as a growing literal floor — A pinned total goes red on a correct tree the moment a module is legitimately added OR deleted; this project already carries that scar in a guard that pinned per-milestone totals. The threshold "on-disk in-scope count >= in-enumeration entry count" catches a broken or empty glob (proven RED) and self-adjusts in both directions. It explicitly supersedes hostpath-consumers.test.ts R2000_MODULE_FLOOR = 14, with the reason recorded at the assertion so a later reader does not restore the literal.
- [Phase 27]: OQ-2 resolved: r2000-verify.ts is recorded capability per criterion 2, but its basis is written as the DISCIPLINE (acmeVerdict at r2000-verify.ts:116) and the tension against EXPORT-01 is stated in the entry note — Criterion 2 is the phase binding text and a registry should not overrule it, but EXPORT-01 states verbatim that the existing verify seam invokes regenerator2000 and parses ITS transcript, so only the discipline survives. Recording the verdict without the tension would hand a later phase a verdict it will contest instead of a basis it can act on.
- [Phase 27]: OQ-4 resolved: both scripts/lib/r2000-cli-verbs files are carried as registry DATA with scope out-of-enumeration, while the enforcing test enumeration stays inside src/mcp/vice/ — CUT-04 names scripts/lib/r2000-cli-verbs.mjs explicitly as a guard whose fate must be recorded, so two entries close that blind spot five phases early; keeping the enumeration inside the module directory respects D-09 and avoids a test that reaches into scripts/. Direction 7 proves the marker does the excluding rather than a special case in the loop.
- [Phase 28]: Annotation data-type vocabulary frozen at twelve members, with all four split-table layouts first-class — Split-table orientation is unrecoverable from a store that never recorded it, so the recovery cost is a hand re-annotation rather than a migration. Both distinguishing axes are separately observable, and the twelve spellings already appear verbatim in a shipped skill playbook.
- [Phase 28]: parseStoreAddress owns the string address forms only; assertRangeShape owns range-ness for both forms — A boundary refusal must be a range-shape error so a caller can tell 'that is not an address' from 'those two ends do not make a range'. Parsing first collapsed the two.
- [Phase 28]: The commit statement is centralised in one private helper shared by first-open init and the write sequence — Keeps exactly one commit site in the seam module, so a durability proof's planted violation has a unique, unambiguous target.
- [Phase 28]: The node:sqlite single-seam detector is one substring test over literal-bodies-kept stripped source, with a comment-only negative control — node:sqlite has four working access routes and only the prefixed specifier resolves; a two-regex import idiom is blind to getBuiltinModule entirely. The cost is the string-literal half of the control, which cannot coexist with literal-bodies-kept mode.
- [Phase 28]: A4's equal-length tie-break non-vacuity is proven by RELABELLING one of two equal-span rows (7/9 -> 9, then 7/3 -> 7), not by exchanging two ids -- exchanging ids between identical spans is a no-op on the row set — The plan's literal 'expect 7 after exchanging the ids' contradicts the rule it pins; array-order reversal plus relabelling carries the intent (no hard-coded answer can satisfy both)
- [Phase 28]: anno-index.ts's import purity is asserted as an exact one-element specifier SET plus family exclusions and a dynamic-import prohibition, NOT as 'import type' — The module imports two error CLASSES it throws, so a type-only import is unreachable; the specifier set is what the constraint actually exists to enforce
- [Phase 28]: AnnoLabelError carries its offending identifier in a field named `identifier`, never `name` -- `name` is `Error.prototype.name`, which every constructor in the AnnoStoreError family assigns the class name to — A public `name` field would overwrite "AnnoLabelError", so a catch block asking which error it caught would be told the answer to a different question. The plan named the field `name`; the rename is the fix.
- [Phase 28]: setDataType now returns AnnoWriteResult { revision, changed: boolean } rather than a touched-row count, and retype short-circuits an exact no-op — Required by the plan own idempotency truth ("the identical range type a second time ... reports changed:false"), and it matches the shape plan 28-05 already declares for SetDataTypeResult. No consumer outside the tests existed. changed is the only no-op signal; the revision still advances by exactly one on every accepted write.
- [Phase 28]: runWriteSequence rolls the whole sequence back when the caller mutation throws, so a refusal raised inside a mutation cannot leave an open transaction with the revision compare-and-swap already applied — The label-collision refusal has to read rows, so it lives inside the mutation transaction (closing the window in which a concurrent writer binds the name between the read and the insert). Without the rollback, currentRevision() reported an advanced revision for a refused write.
- [Phase 28]: Project-enum variant keys are validated against the four numeric-string forms the schema names but NEVER canonicalised, and two keys naming the same value are refused — Round-tripping by value is the store contract, so a caller that wrote "$40" reads back "$40" -- a rewritten key is a value the caller never supplied. Two keys for one value would be two variant names for one number, with nothing downstream able to say which was meant.
- [Phase 28]: block-class.ts's boundary accepts BOTH block vocabularies during the transition -- the store's lowercase twelve and the external analyser's capitalised four -- rather than flipping to lowercase — The live census input and all six committed coverage fixtures still carry the analyser's capitalised spellings. A flip would have reclassified every one as data, silently, which is the exact failure the milestone guards against, and would have forced a fixture migration no criterion asks for. The capitalised arm is labelled TRANSITIONAL with its removal condition stated as CUT-01.
- [Phase 28]: The label-kind agreement check partitions LABEL_KINDS BY MEASUREMENT into the three the census compares explicitly and the one it infers, instead of asserting all four appear as literals — Measured this session: r2000-coverage.ts never spells "Auto", because computeLabelRatio tests System/Platform then User and infers auto from its else branch. The partition form is strictly stronger -- a re-spelt store member moves out of the spelled set, a census that starts comparing the fallthrough explicitly moves it in, and either direction moves an asserted count.
- [Phase 28]: The retype byte-preservation invariant is asserted in its UNION form (total typed bytes after equals the size of covered-before union the new range), not the literal "total unchanged" — The literal form is unsatisfiable by the CORRECT implementation in overlap case 2 (a new range legitimately types addresses nothing had typed), and is satisfied exactly by a BROKEN one in case 4, where 128 dropped tail bytes balance 128 newly typed low bytes while 128 previously typed addresses silently lose their type. Measured, and pinned as its own named test so invariant B (every previously typed address still typed) is justified by measurement rather than argument.
- [Phase 28]: A contradicted comment is returned as DATA on a successful retype, never as an error and never as a refusal, and no option exists to make it a refusal — A refusal would push a caller toward deleting the comment to get the retype through, converting a reported loss into a silent one -- the exact outcome the report exists to prevent. The reason is written into anno-store.ts header trap 9, not only into the plan.
- [Phase 28]: Filter-and-insert reddens THREE overlap cases (3, 4 and 5), not one, correcting the phase planted-violation model — Case 4 always has a tail (d < b) and case 5 always a head (a < c), so both lose bytes under filter-and-insert; only cases 1 and 2 have neither. Case 3 remains uniquely load-bearing because it is the only case losing BOTH sides and the only one whose correct answer is three rows.
- [Phase 28]: Snapshot pruning runs AFTER the commit and OUTSIDE the write transaction, deleting the file before its pointer row — A filesystem unlink is not transactional. Pruning inside the transaction means a rollback leaves a pointer row aimed at a file that is already gone -- the one failure direction the revert path cannot survive. The chosen direction is EXTRA files, which are harmless and reconcilable by revision number.
- [Phase 28]: A revert to a revision the ring no longer retains is REFUSED by name, never substituted with the nearest retained snapshot — Returning a revision other than the one asked for changes the caller's intent with nothing recording that it happened. The refusal message carries the requested revision, the oldest retained one, the current one and the bound.
- [Phase 28]: oldestRetainedRevision() reads the pointer ROWS, and reports a named NO_RETAINED_REVISION sentinel on an empty ring — currentRevision() - MAX_SNAPSHOT_REVISIONS agrees with the rows only on a store written forward; after a revert the arithmetic names a revision no row records. A floor naming an unrevertable revision is worse than no floor.
- [Phase 28]: node:sqlite is now bounded in the TEST tree by a declared one-element list, and its member is anno-seam.test.ts itself — shippedTsModules() derives from files[], which excludes test files, so the test tree was outside STORE-07's scope by construction. The plan expected the store's own test file to need the import; measured false (AnnoStoreHandle exposes its db). The guard file is the one member because its planted route strings are string literals a keepLiteralBodies specifier scan cannot distinguish from route (d).
- [Phase 28]: The mutator's mutation is a single raw insert rather than setDataType — setDataType hard-wires the committing wrapper, so routing one mode through it would make the committing and planted modes differ in more than the commit -- the exact drift a parameterised planting exists to prevent. retype()'s split-and-preserve logic is STORE-02's subject and is proven in anno-overlap.test.ts.
- [Phase 28]: reconcileSnapshotRing reads retainedRevisions() rather than re-deciding with an existsSync of its own -- one predicate, every consumer, so the row-only regression cannot hide from the proofs that catch it — A fourth independent existsSync would both reintroduce the three-way drift this plan exists to remove and leave the mandated planted red green
- [Phase 28]: A snapshot FILE is removed only after the store has stopped claiming its revision; a revert reconciles the restored pointer table against the directory, and the refusal for a missing file is the same named AnnoStoreError a missing row already produced — Closes 28-VERIFICATION gaps 1 and 2 (CR-01, WR-01, WR-02); the published floor can no longer name a revision revertTo would refuse
- [Phase 28]: A published snapshot has exactly ONE writer -- the one whose compare-and-swap won and whose pointer row commits it: stageSnapshot vacuums into a per-ATTEMPT r<rev>.<pid>.<uuid>.tmp, publishSnapshot renames onto r<rev>.db only after the CAS, discardSnapshot cleans every other exit — The pre-fix comment removed the published path before the lock on a TRUE premise (vacuum into refuses an existing target; a revision number recurs after a revert); the recurrence is now handled by the rename, which overwrites without a prior removal and is performed by the owner. A refusal must be indistinguishable from the attempt never having happened, on disk included
- [Phase 28]: The WR-11 CAS-failure branch is pinned STRUCTURALLY with the reason stated in the test, and the second revision is read from anno_meta BEFORE the rollback — runWriteSequence is fully synchronous, so no in-process interleave can land between the pre-transaction read and begin immediate, and a spawned child racing it would be timing-dependent -- a flaky probe is worse evidence than an honest structural one. The reachable pre-transaction arm stays behaviourally pinned at anno-store.test.ts:320
- [Phase 28]: Phase 28 (28-09): workspace confinement resolves REAL paths on BOTH sides through a deepest-existing-ancestor walk, and the resolution lives in the VALIDATOR (anno-types.ts), not in the persistence module. Siting it in anno-store.ts would have preserved the research map's purity row and the three-entry import pin, at the cost of splitting one confinement contract across two modules with the security-relevant half in the module whose header does not claim confinement -- a caller that skipped the pre-resolution would get a passing check and a store file outside the workspace, which is CR-03 again with a new cause and no test watching. The module that declares a contract must be the module that cannot answer it wrongly. node:fs is a Node builtin, not a seam; the closed hostpath consumer set is unchanged.
- [Phase 28]: Phase 28 (28-09): an allow/deny control is proven by TWO plantings, not one. The pre-fix code must redden the REFUSAL test, and the over-broad wrong fix (refuse everything) must redden a DISCRIMINATING test. A confinement control that only ever refuses is indistinguishable from one that works, and a single planting cannot tell them apart. Applied here: reverting to resolve() reddened the symlink refusal (and a standalone probe reproduced the verifier's own "file created outside workspace: true"), while refusing every symlinked path left the refusal green and reddened the inside-pointing-symlink follow.
- [Phase 28]: D-A (28-10, one-way): the snapshot ring is keyed on the store FILE and anno_snapshot.path is DROPPED, with SCHEMA_VERSION 1 -> 2 refusing a previous-shape store by name and leaving its legacy <dir>/snapshots ring untouched — Option a-bump-and-refuse. Rejected b-silent-history-loss (an existing store keeps opening but its entire revert history becomes unreachable with NO signal, and a persisted absolute-path column stays on disk for a future edit to read -- CR-03's primitive left in place) and c-migrate (with two stores in one directory the legacy ring is genuinely ambiguous, so a migration would attribute a neighbour's snapshots to whichever store opens first -- CR-01 again with a new cause and no test watching). Accepted cost: an existing store's annotations need a hand migration. Safe because the store is unreleased -- every store on disk today is a phase-28 test fixture.
- [Phase 28]: CR-01 is fixed by renaming the LOCATION, not by an ownership predicate: two distinct store files in one directory have distinct basenames by definition of a filesystem, so distinct rings follow by construction — 28-07's per-revision ownership predicate over the shared <dir>/snapshots ring was structurally blind to CR-01 because revision numbers are not unique ACROSS stores -- two stores both write r1.db and every per-revision predicate answers "mine" to both. A location that cannot collide has no such blind spot. Residual stated rather than closed: renaming the store FILE re-points the ring name, the old ring becomes unreachable and is deliberately never deleted, and retainedRevisions() honestly reports [] -- an accepted under-claim over guessing which ring a renamed store used to own.
- [Phase 28]: The snapshot sweep serialises its judgement under `begin immediate` rather than aging files against a grace bound — Gap 1's remedy 2 offered both routes. A grace bound is a guess about how long a writer may sit between its `renameSync` and its transaction's end: it has a tuned constant, it is wrong for a writer that is paged out or stopped at a debugger, and the next reproduction of CR-02 would arrive as "raise the constant". The lock is exact by derivation instead — publication is reachable only from behind a won compare-and-swap, which runs inside `begin immediate`, so the publish-to-commit window and the write-lock hold are the same interval. Nothing is timed.
- [Phase 28]: `pruneSnapshots` returns early when its own sweep reports `deferred`, and the resulting write latency is shipped as a stated fact — Pressing on would compute a doomed set over a ring the sweep just declined to reconcile — 28-07 P2's forbidden shape with an extra step — and its autocommit deletes would block a second five-second `busy_timeout` before failing `SQLITE_BUSY` into WR-02's swallowing wrap, so a contended write would pay roughly ten seconds silently for work guaranteed to be redone. The accepted cost is one more write's worth of un-pruned ring (extra files, the harmless direction) and up to ONE five-second stall per contended accepted write and per contended `revertTo` — both on paths Phase 29 exposes as MCP tools. Recorded in the `reconcileSnapshotRing` doc comment, not only in the plan.
- [Phase 28]: `revertTo` step 6's directory-bound claim is recorded as a reversal in place rather than deleted, and its first clause is explicitly preserved — Trap 10's own correction is this module's precedent: a rationale that became false is evidence. The sweep can now decline under contention, so "the directory bound holds after a revert as well as before one" became an over-claim and is now conditional on the sweep not having deferred. The first clause — the handle never advertises a revision it cannot deliver — survives byte-identical in meaning, because the published floor still routes through `retainedRevisions()`, which requires both the pointer row and the file regardless of whether the sweep ran. Demonstrated removal rather than a vacuous search: `grep -cF 'well as before one.'` went from 1 to 0 while `grep -c 'unless the sweep deferred'` went from 0 to 1.
- [Phase 28]: Path-entry existence in `anno-types.ts`'s confinement walk is decided with `lstatSync(p, { throwIfNoEntry: false })`, not `existsSync` — The two answers differ for exactly one input class -- a symlink whose target is absent -- and that class was the whole of CR-04: `existsSync` follows links, so a dangling one read as absent and the walk stepped PAST it, after which the confinement compared a path the filesystem would resolve elsewhere. Reproduced: "A) confinement ACCEPTED" with "A) file created OUTSIDE workspace: true".
- [Phase 28]: A dangling stopping entry is resolved by hand with `readlinkSync` against `dirname(current)`, bounded by `MAX_SYMLINK_HOPS = 40` — `realpathSync` cannot resolve a chain whose end does not exist, so the hop has to be ours -- and resolving a relative target against the process cwd instead of the link's own directory is the one way a naive `readlinkSync` fix gets this wrong. 40 is Linux's own MAXSYMLINKS, so a chain this walk refuses is one the kernel would refuse too; the bound exists because a cycle is otherwise an infinite loop on unvalidated transport input.
- [Phase 28]: The store confinement's check-then-open window is a STATED limit, never a handled case — The confinement decision and the file creation are two separate filesystem operations, and a link planted between them redirects the write while every refusal test still passes. `node:sqlite`'s `DatabaseSync` constructor takes a path, not a file descriptor, so there is no `O_NOFOLLOW`/`openat` route to making the check and the open one operation. Recorded in `anno-confinement.test.ts`'s header beside the controls, and as a `backstop` truth -- never described as closed.

### Pending Todos

3 pending (3 files in `.planning/todos/pending/` + 0 UAT-gap rows = 3) — see
`.planning/todos/pending/` (`/gsd-capture --list`). The count
is authoritative in `## Deferred Items` below, which is derived from the todo
tree and guarded in both directions by `docs-deferred-ledger.test.ts`. This
section previously read 18 (set at the phase 13 close) before rising and
falling again across Phase 15's own dispositioning work (see below); between
the phase 13 close and now,
phase 14 plan 14-03 filed one more (the `tools-manifest.json` staleness
finding) and other tail activity filed two more (a phase-12 regression-gate
finding and the phase-13-close review-disposition finding), bringing the
count to 21, before phase 14 plan 14-05 closed the fork-backend-removal
question against the dated `FORK-01` decision, moving it to
`.planning/todos/completed/` and returning the count to 20. Phase 15 plan
15-01 then filed one more (`03-REVIEW.md`'s eight newly-surfaced findings,
one todo), bringing the count to 21, before phase 15 plan 15-04 fixed all
eight of that todo's findings (WR-06/WR-07/WR-08, IN-02/IN-03/IN-04/IN-05/
IN-06) and closed it — moved to `.planning/todos/completed/` with a
Resolution section — returning the count to 20. Phase 15 plan 15-05 then
closed the Phase 09 `IN-01`..`IN-03` todo `wont-fix` (evidence immutability;
see `.planning/todos/completed/`), returning the count to 19, and closed the
Phase 13 `WR-01`/`WR-02`/`IN-01`/`IN-02` todo (`WR-01` already fixed and now
pinned; the other three deferred/promoted with named triggers/owners — see
`.planning/todos/completed/`), returning the count to 18. Phase 15 plan 15-06
Task 1 then closed the drive-type-prerequisite and project-root-`.git`-marker
todos (DEBT-02 items 1 and 2), both documented at the point of use in
`c64-ram-capture/SKILL.md` — see `.planning/todos/completed/` for both
Resolutions — returning the count to 16. Task 2 then closed DEBT-02's third
item, the `RELEASES.json` schema todo, adding a `## Release registry shape`
section plus a copyable `RELEASES.json.example` — returning the count to 15.
Phase 15 plan 15-07 then closed the `build-atomic.test.ts` flake, the
mislabelled `cpuhistory-get*` fixtures, and the ACME/regenerator2000 gate
migration (three todos, see `.planning/todos/completed/`), returning the
count to 12. Phase 15 plan 15-09 then closed the `vice_ping`
`resolvedBinaryPath` documentation todo and the warp-over-RESOURCE_SET
refutation todo, returning the count to 10. Phase 15 plan 15-10 then live-answered
A4 (the `stop:false` rate-limiter's auto-disable deferral timing, CONFIRMED
against genuine stock VICE) and closed the `2026-08-14-probe-phase3-assumed-
wire-details` todo in full — see `.planning/todos/completed/` for its
Resolution — returning the count to 9. Phase 15 plan 15-11 Task 1 then
corrected `vice_disk_attach`'s refuted no-side-effect record (both the
returned approximation string and `docs/stock-vice-parity.md`'s D-14 bullet)
and closed that todo — see `.planning/todos/completed/` — returning the count
to 8. Task 2 then closed the `tools-manifest.json` staleness todo `wont-fix`
on the inverted D-16 ground and fixed `fork-live.test.ts`'s reporting so the
same false finding cannot recur — see `.planning/todos/completed/` —
returning the count to 7. Task 3 then settled the CI test-command divergence
from a real GitHub Actions run's own log (run `32517575905`; all nine
`MANUAL_ONLY_TESTS` suites pass cleanly on the runner, so `npm test` stays in
CI, documented with the run id in `ci.yml`'s `Test`-step comment) and closed
that todo too — see `.planning/todos/completed/` — returning the count to 6.
**Phase 15 plan 15-12 (the phase's designated closer) then closed all four remaining
"genuinely close now" todos in one task:** the Phase 08 review todo (`WR-04`
through `WR-13`, ten findings — both plans 15-02 and 15-03 had already fixed all
ten at source; this closure transcribes their per-finding verdicts with
resolvable commits into one `## Resolution` table), the broker-tests-stall todo
(`wont-fix`, promoting the pre-existing 2026-08-12 user decision), the `.vsf`
bootstrap-input todo (`wont-fix`, quoting `REQUIREMENTS.md`'s own Out of Scope
table verbatim — required updating three shipped runtime/comment string
literals in `r2000-cli.ts`/`r2000-project.ts` and `docs-dangling-refs.test.ts`'s
own `VSF_BACKLOG_ITEM` constant from `pending/` to `completed/`, since the
r2000 CLI's own refusal message names this exact path), and the
keyboard-fallback-load todo (promoted with a named owner — neither of the
two closing conditions the plan named was met by plan 15-08's live evidence:
scenario 1 used `vice_autostart`, not the keyboard-typed `LOAD` route, and
scenario 2's `vice_keyboard_petscii` injection proved keyboard injection
works but never issued a `LOAD` command, so neither reproduced this todo's
specific stall nor demonstrated the fallback route working) — see
`.planning/todos/completed/` for all four Resolutions. Two todos remain
pending, both promoted to a Phase 16 requirement with a named owner rather
than fixed here (`2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json`
→ `PKG-01`; `2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments`
→ `PKG-03`; both already carry `resolves_phase: 16` in their own frontmatter) —
returning the count to **2**. See `## Deferred
Items` below for the current, itemised list — this prose figure must always
equal that section's table row count, which has gone stale twice before and
is not itself guarded.

**As of phase 15 plan 15-12 Task 1 (2026-08-22), only two todos remained pending
— both promoted, neither fixed nor closed at that point.** Plan 15-12 Task 1 closed the
four todos that used to fill this paragraph's "newest pending" slot —
`2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned` (ten
Phase 08 findings, transcribed with resolvable commits from plans 15-02/15-03),
`2026-08-12-vice-broker-tests-stall-outside-devcontainer` (`wont-fix`,
promoting the pre-existing 2026-08-12 decision), `2026-08-20-vsf-as-a-
bootstrap-input` (`wont-fix`, quoting `REQUIREMENTS.md`'s own Out of Scope
line verbatim), and `2026-08-19-keyboard-fallback-load-does-not-progress-
within-bounded-poll` (promoted with a named owner — plan 15-08's live
evidence bore on neither of the two closing conditions) — see
`.planning/todos/completed/` for all four Resolutions.

The two todos that had remained pending were `2026-08-20-relocate-plugin-payload-
under-src-and-merge-mcp-json` and `2026-08-21-stale-phase-pointers-in-stock-
cia-and-stock-dispatch-comments`, both promoted to named Phase 16
requirements (`PKG-01` and `PKG-03` respectively — both todos already carried
`resolves_phase: 16` in their own frontmatter, confirmed against
`REQUIREMENTS.md`'s Phase 16 goal text before promoting) rather than fixed in
Phase 15. Neither was carried silently: both were recorded with named owners
in `REQUIREMENTS.md` → Future Requirements → `### Promoted by DEBT-01`.

**Phase 16 then closed both** (2026-08-23): `PKG-01` and `PKG-03` both read
`Complete` in `REQUIREMENTS.md`'s Traceability table, and
`.planning/todos/pending/` is empty for the first time in this project's
history. Phase 17 plan 17-01 Task 2 (2026-08-23) measured the true count and
found it 0, updating this section's opening figure from 2 to 0.

**The tree is no longer empty (2026-08-24).** One todo was filed outside phase
work — `2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path`,
capturing the per-launch `vice-broker-vicerc-*` scratch-dir leak at
`broker-launch.mts:329` and naming the broker kill/recycle path as its owner,
exactly as that file's own header comment specifies. It was deferred out of
Phase 18 deliberately: reaping is a change to broker lifetime semantics, not
part of Phase 18's goal. Filing it re-armed
`docs-deferred-ledger.test.ts` direction A, which had been inert for as long as
the tree was empty — hence the matching row added to `## Deferred Items` below
in the same change. This section's opening figure above (`3 pending`) is
derived from, and must always equal, `## Deferred Items`'s table row count
below — a discipline that has gone stale twice before and is not itself
guarded.

**A second todo was filed 2026-08-26**, also outside phase work, during
`/gsd-discuss-phase 23`:
`2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md`.
`.planning/research/questions.md` frames Phase 23's measurements as
"answerable against the existing `c64-provenance-diff` fixtures — real
releases, already committed", which is false for this repo: that skill reads a
*consuming* project's `recovery/` tree, and the only binaries here are three
synthetic probe fixtures. ROADMAP.md's Phase 23 Notes already say the opposite
and correct thing, so the repo contradicts itself with the wrong version in the
file `gsd-phase-researcher` reads first. Deferred out of the discussion rather
than fixed inline because it is a documentation correction, not a phase-context
decision — but it should land before `/gsd-plan-phase 23` runs.

**A third todo was filed 2026-08-26**, also outside phase work, via
`/gsd-capture`:
`2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it`.
`buildViceArgs()` (`broker-launch.mts:153`) emits one fixed argv per backend
with no display or speed flag, so every broker-launched `x64sc` boots as a full
interactive, real-time emulator — correct for a human watching the screen,
wasteful for the live suites, corpus sweeps and capture runs where nobody
looks. The only existing escape hatch, `VICE_ARGS`, is a whole-argv override
(it would drop the monitor flags too), so it cannot serve as an additive knob.
Warp in particular has to be launch-time on stock (CLAUDE.md's settled
no-runtime-`WarpMode` constraint), and any implementation has to keep
`-default` at index 0 ahead of `-binarymonitor` and re-check the real-time
timeouts in `probeReady`/`vice-sync.ts` under warp.

**That same todo was widened 2026-08-26** (same `/gsd-capture` route, merged
rather than filed separately because it is the same implementation): VICE does
not have to be pre-started at all — it should start on demand in the mode the
run wants and shut down after. Teardown already behaves that way
(`handleRelease()`, `vice-broker.mts:929`, is kill-never-recycle). The start
side is the blocker, and it is structural, not a missing flag: the warm floor
defaults to 1 (`vice-broker.mts:169`, `broker-launch.mts:850`), so
`maintainWarmFloor()` boots an instance before any request exists and therefore
before its mode is known; `selectWarmInstance()` (`vice-broker.mts:473`) then
runs ahead of the cold-launch arm, so that pre-warmed interactive instance wins
the grant; and the acquire frame (`{ op: "acquire", id, token }`,
`vice-broker-client.ts:372`) has no field in which to ask for a mode. Net: the
headless/warp flags are inert as a per-run choice until launch mode becomes part
of both the acquire request and warm-instance eligibility. **Anyone triaging by
slug should note the on-demand-lifecycle ask lives inside this
headless/warp-titled todo, not in a separate row.**

**A fourth todo was filed 2026-08-26**, during Phase 23's execution tail:
`2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex`.
23-03 could not produce a verified flat 64K capture and named two independent
causes; this todo removes one of them with a validated method. A VICE `.vsf`
snapshot already contains the exact 64K — the `C64MEM` module body is 4 bytes of
port/PLA state followed by 65536 bytes of RAM — so the image is a slice with no
transcription step, which is where 23-03 lost a 32 KB write to truncation and an
8 KB write to ten silently dropped characters. Validated against 23-03's own
hand-transcribed hex: two 8 KB chunks byte-identical, one differing only at
`$0000`/`$0001` (the 6510 port overlay the snapshot stores beneath), and the
fourth independently localising the dropped characters to `$7871`. **It does not
fix the second cause** — the fork's stopping exec checkpoint is not frame-exact,
and two `danish` snapshots diffed directly still show 201 multi-bit divergences
— so it did **not** change Phase 23's `no-go` verdict and must not be read as
though it did. Carried as a pending todo rather than acted on because Phase 23 is
forbidden from modifying anything under `src/`.

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
| 260823-kf6 | Correct STATE.md's carried-forward ledger: QUAL-01/02/03 closed by PKG-02/03/04, plus DEBT-04's closure note | 2026-08-23 | 793d8bc, 8205ef9, 0bc005c, a2ea0a0 | passed (orchestrator re-read all three corrected sites — STATE.md's table, STATE.md's Deferred Items prose, REQUIREMENTS.md's DEBT-04 note — and confirmed they agree on one surviving open row (`UP-01`/`UP-02`); the derived `0 items` count, the `UP-01`/`UP-02` row and REQUIREMENTS.md's open `### Control-Plane Bind Follow-on` all preserved; `PKG-04` recorded as accepted risk, not narrowed. The one `npm test` failure (`audit-integrity.test.ts` T-12-04, a hard-coded `tech_debt` count of 3 against 4 audit files) independently confirmed pre-existing — introduced by `76f7b15`, the pre-task HEAD, and this task touched no audit file) | [260823-kf6-correct-state-md-s-carried-forward-ledge](./quick/260823-kf6-correct-state-md-s-carried-forward-ledge/) |

### Blockers/Concerns

- **Phase 27 carried items (2026-08-27), none blocking Phase 28.** Three deferred
  items survive the phase in `27-shared-seams-extracted/deferred-items.md`:
  `D-27-02-A` — `r2000-session.test.ts`'s five plan-18-06 queue tests spawn a real
  `regenerator2000` child with no gate, so they FAIL where their gated siblings SKIP
  on a host without the binary; `D-27-05-A` — `vice-proxy.test.ts` leaks two LISTEN
  sockets, so the whole-glob `npm test` never terminates unaided (budget for killing
  the child once results have emitted); `D-27-05-B` — in `module-classification.ts`,
  `contested` is prose-only rather than a structured field and `note` is exempt from
  Direction 4's prefix scan, so a *future* contested verdict or a prefix justification
  parked in `note` has no mechanical gate. All three accepted on the record at the
  Phase 27 UAT (2026-08-27), not silently inherited.

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

- ABS-02 reads Complete in REQUIREMENTS.md (line 131, checkbox line 46), set by 19-07's metadata commit 354bbfa via the automatic requirements.mark-complete step — a requirement marked complete by the run that fixed it. 19-09 reported it rather than editing (read-only over REQUIREMENTS.md by must_haves and threat T-19G-09-03). Phase 19 re-verification must treat ABS-02's Complete as unearned and re-decide it on the evidence.

## Deferred Items

**13 items acknowledged and deferred at the v0.2.0 milestone close on 2026-08-19**
(superseded by the current count below, kept here as history rather than
overwritten). The pre-close artifact audit reported these; the round-4
milestone audit had already assessed the same set as `tech_debt` with no
blockers. They were accepted rather than resolved, and were v0.3.0's
inheritance unless dispositioned sooner.

**As of phase 13 plan 13-05's close (2026-08-22): 19 items — 18 pending
todos plus Phase 03's UAT gap — derived from `.planning/todos/pending/` and
guarded by `docs-deferred-ledger.test.ts` (AUDIT-04) — this table is no longer
hand-maintained (superseded by the current count below).** Phase 13 closed two of the three highest-value carried
probe-debt todos against real binaries: the binmon-fixture re-record todo
(closing `EXTV-01`) and the `--help` backend-discriminator todo (closing
`EXTV-02`) — both moved to `.planning/todos/completed/` with Resolution
sections citing plans 13-01/13-02's commits and evidence documents. The
third — the Phase 3 wire-assumption probe-debt item (closed in full by phase 15 plan 15-10; see
`.planning/todos/completed/`) — stayed pending at this point: three
of its four wire assumptions (A1/A2/A3/A5, live-probed by plan 13-03) were
then answered, and it was trimmed to A4 — the `stop:false` rate-limiter's
auto-disable deferral timing — as its only remaining item, deliberately
excluded at that time because arming that probe risked stalling the emulator's CPU loop.
Phase 13 also filed two new todos for findings it surfaced but did not fix:
a mislabelled `cpuhistory-get*` sidecar pair (`capturedFrom: "stock"`
recorded for a fork binary) and an advertised-tool-contract finding for
`vice_disk_attach` (its documented no-side-effect approximation is
empirically false, per plan 13-03's A5 probe). The pending count holds at 18
— two closed, two filed — by arithmetic coincidence, not because nothing
moved.

Before phase 13, the 18th todo was filed *at the v0.3.0 close*: the same
`docs-review-disposition.test.ts` guard, run as part of the close, was found red
at `4f048bb` with Phase 09's `IN-01`..`IN-03` undispositioned — predating the
close, not caused by it. That todo was later closed `wont-fix` by Phase 15
plan 15-05 on evidence-immutability grounds — see `.planning/todos/completed/`
for the Resolution. 4 of the 18 were
opened during v0.3.0 (the fork-backend-removal question — resolved 2026-08-22
by Phase 14 plan 14-05, see `.planning/todos/completed/` for the Resolution
section;
the plugin-payload relocation under `src/` with the `.mcp.json` merge
(resolved 2026-08-23 by Phase 16 as `PKG-01`, see `.planning/todos/completed/`
for the closed todo),
the `.vsf`-as-a-regenerator2000-bootstrap-input backlog item (resolved
`wont-fix` 2026-08-22 by Phase 15 plan 15-12, quoting `REQUIREMENTS.md`'s own
Out of Scope line — see `.planning/todos/completed/` for the Resolution), and
the warp-over-RESOURCE_SET
refutation (resolved 2026-08-22 by Phase 15 plan 15-09, see
`.planning/todos/completed/` for the Resolution)); 3 more were opened
by Phase 11.1 itself while dispositioning Phase 10/11's review findings and
building Task 4's completeness guard, which caught undispositioned findings
outside Phase 10/11 too
(the hand-copied ACME/regenerator2000 gate migration — resolved 2026-08-22 by
Phase 15 plan 15-07, see `.planning/todos/completed/` for the Resolution;
the stale phase pointers in `stock-cia.ts` and `stock-dispatch.ts` comments
(resolved 2026-08-23 by Phase 16 as `PKG-03`, see `.planning/todos/completed/`
for the closed todo);
the Phase 08 review-disposition backlog item, v0.2.0's `08-REVIEW.md`
`WR-04`..`WR-13`, resolved 2026-08-22 by Phase 15 plans 15-02/15-03/15-12 —
see `.planning/todos/completed/` for the Resolution).
**Three rows from the 2026-08-19/18-items counts above are removed here
because their todos now live in `.planning/todos/completed/`, not because the
items were dropped:** the second-binmon-client wedge-lookalike documentation
todo (2026-08-17), the acme-build scaffold-library todo (2026-08-19), and
WR-08's flag-shaped/missing option-value todo (2026-08-21, closed by quick
task 260821-jd8 — assigned T-10-19 in `10-SECURITY.md`, now `status:
verified` / `threats_open: 0`) are all resolved and closed — see
`.planning/todos/completed/` for the filed resolutions.

Before phase 15, as of phase 14 plan 14-05 (2026-08-22): 21 items — 20
pending todos plus Phase 03's UAT gap. Between the phase-13 close and then,
one todo was filed by 14-03 (the `tools-manifest.json` staleness finding, see
below) and other tail activity added two more (a phase-12 regression-gate
finding and the phase-13-close review-disposition finding, both listed
below), bringing pending to 21. Plan 14-05 then closed the
fork-backend-removal question against the dated `FORK-01` decision (`retain`)
— its todo moved to `.planning/todos/completed/` with a Resolution section —
leaving the count at 20 pending todos.

**Current, as of phase 15 plan 15-01 (2026-08-22): 22 items — 21 pending
todos plus Phase 03's UAT gap.** Task 1 widened
`docs-review-disposition.test.ts`'s parser (`^### (WR|IN|CR)-(\d+):` →
any heading level 2-6, id terminated at the first non-digit), which surfaced
31 previously-invisible findings (119 → 150 total) and 9 genuinely
undispositioned among them. Task 2 closed `14-REVIEW.md`'s `IN-01` with a
cited, commit-referencing disposition, filed to `.planning/todos/completed/`
(see that directory for the full record) — fixed in Phase 14, never
previously cited in a source the guard recognises. Task 3 (this update)
files `03-REVIEW.md`'s remaining eight (`WR-06`, `WR-07`, `WR-08`, `IN-02`,
`IN-03`, `IN-04`, `IN-05`, `IN-06`) as one new pending todo, owned by plan
15-04 — see the table row below. Pending count rises 20 → 21 (one filed,
none moved to completed); total items 21 → 22.

Plan 15-04 then fixed all eight of that todo's findings and closed it,
returning pending to 20 (total 21). Task 2 of plan 15-05 closed
`09-REVIEW.md`'s `IN-01`..`IN-03` `wont-fix` on evidence-immutability
grounds, moving that todo to `.planning/todos/completed/` — pending 20 → 19,
total 21 → 20. Task 3 closed
`13-REVIEW.md`'s `WR-01`/`WR-02`/`IN-01`/`IN-02` todo — `WR-01` already fixed
at source (commit `f73d0fa`) and now pinned by a derived test; `WR-02` and
`IN-01` deferred with stated reopen triggers; `IN-02` promoted out of this
repo to plan 15-12 — moving that todo to `.planning/todos/completed/` too:
pending 19 → 18, total 20 → 19. Plan 15-06 Task 1 then closed DEBT-02's
drive-type-prerequisite and project-root-`.git`-marker todos, documenting
both at the point of use in `c64-ram-capture/SKILL.md` (`## Boot a disk`'s
closing sentence and the new prerequisite line before `## The order`) —
pending 18 → 16, total 19 → 17. Plan 15-06 Task 2 then closed DEBT-02's
third item, `RELEASES.json`'s undocumented schema, adding a `## Release
registry shape` section (before `## References`) and a copyable
`RELEASES.json.example` — pending 16 → 15, total 17 → 16. Plan 15-07 Task 1
then closed the `build-atomic.test.ts` cleanup-scan flake (fixed at commit
`7484afa`, immune to concurrent `build()` callers) — pending 15 → 14, total
16 → 15. Task 2 then corrected the two `cpuhistory-get*` sidecars'
`capturedFrom` kind from `stock` to `fork` (commit `d67f0ef`), with the
derive-the-kind-automatically sub-item promoted to a named follow-on rather
than implemented, since it would touch `probe-binmon.mjs` — pending 14 → 13,
total 15 → 14. Task 3 then migrated the three hand-copied ACME/regenerator2000
gates in `r2000-cli.test.ts`, `r2000-project.test.ts` and
`disasm-roundtrip.test.ts` onto the shared `r2000-test-gate.ts` seam (commit
`185187a`), proven by a measured before/after pass-count table (identical in
both the default and opt-in runs) — pending 13 → 12, total 14 → 13. Plan 15-09
then closed the `vice_ping` `resolvedBinaryPath` documentation todo (a
`resolvedBinaryPathScope` sibling field added to the response, plus a
module-scope comment in `vice-proxy.ts`, pinned by a new
`vice-proxy-ping.test.ts`) and the warp-over-RESOURCE_SET refutation todo
(`GAINS-PROTOCOL.md`'s error codes corrected, a fork-only caveat landed in
`docs/stock-vice-parity.md` and `capability-registry.ts`, `docs/tool-support.md`
regenerated) — pending 12 → 10, total 13 → 11.
Plan 15-10 then answered A4 (the `stop:false` rate-limiter's auto-disable deferral timing) live
against genuine stock VICE — a real KERNAL-IRQ-hot checkpoint exceeded the D-11 guard's
20-hits-per-second limit, the auto-disable fired, its wire-side `enabled` flag was independently
confirmed `false`, and the emulator kept progressing afterward. Verdict CONFIRMED (for the rates
and host tested); no new todo was filed. The Phase 3 probe-debt todo left carrying only that
final assumption is closed in full (all five original assumptions accounted for — see its own
`## Resolution` in `.planning/todos/completed/`) — pending 10 → 9, total 11 → 10.
Plan 15-11 Task 1 then closed the `vice_disk_attach` approximation-contradicted-
by-A5 todo — `stock-machine.ts`'s `handleDiskAttach` and `docs/stock-vice-parity.md`'s
D-14 bullet both corrected to state the real reset-plus-load behaviour Phase 13's
A5 probe observed, with the contract-redesign question promoted to
`REQUIREMENTS.md` → Future Requirements (owner: plan 15-12, not yet landed) —
pending 9 → 8, total 10 → 9.
Plan 15-11 Task 2 then closed the `tools-manifest.json` staleness todo
`wont-fix` on the inverted D-16 ground (`vice_snapshot_list`'s absence is a
deliberate deletion, not staleness — regenerating would silently re-add it),
and fixed `fork-live.test.ts`'s live-surface diff so it no longer reports a
D-16-deleted name as an undifferentiated finding — pending 8 → 7, total 9 → 8.
Task 3 then settled the CI test-command divergence from a real GitHub Actions
run's own log (run `32517575905`, 2026-08-21): all nine `MANUAL_ONLY_TESTS`
suites pass cleanly on the runner in under two minutes, so `npm test` stays
in CI (deliberately wider than the local `npm run test:automated` gate),
documented in a comment above `ci.yml`'s `Test` step citing the run id — and
closed the todo — pending 7 → 6, total 8 → 7.
**Current, as of Phase 17 plan 17-01 Task 2 (2026-08-23): 0 items — 0 pending
todos, zero UAT gaps.** This is the first time the pending-todo tree has read
empty in this project's history. Phase 16 discharged both todos that were
still pending at the Phase 15 close — `PKG-01` (the plugin-payload relocation
under `src/` with the `.mcp.json` merge) and `PKG-03` (the stale phase
pointers in `stock-cia.ts`/`stock-dispatch.ts` comments) — moving this count
**2 → 0**. The count in this paragraph is derived from
`.planning/todos/pending/` and guarded in both directions by
`docs-deferred-ledger.test.ts`, whose non-vacuity floor this phase's own plan
17-01 task 1 lowered from `pending.length >= 2` to no floor at all: the
previous floor of two could not express a genuinely empty tree, and the
guard's own prior-author comment named this exact phase as the one that might
need to lower it further. The arithmetic in full: 0 pending todo files in `.planning/todos/pending/` + 0 UAT-gap rows = 0.
This 0 excludes, and does not resolve, two categories this table's own accounting rule
(pending todo files plus any open UAT-gap row) never covered and still does not scan — the
guard's own header comment records both scoping exclusions explicitly, and this paragraph
states them rather than leaving a reader to infer zero known debt: the `### Carried forward
from earlier closes` table below, which now carries a single still-open row (`UP-01`/`UP-02`
— one row, two items, genuinely still open upstream), and the roughly fifteen carried
WR-class code-review findings enumerated in `milestones/v0.2.0-MILESTONE-AUDIT.md`. Neither
category is changed by this measurement. The three `QUAL-01`..`QUAL-03` rows this paragraph
counted among the exclusions until 2026-08-23 were **not** open: this milestone's own Phase 16
closed all three (`PKG-02`/`PKG-03`/`PKG-04`), and `v0.4.0-MILESTONE-AUDIT.md`'s round-1
tech-debt cluster 1 caught the stale rows at the milestone audit. Corrected, with the table,
by `.planning/quick/260823-kf6`.

| Category | Item | Priority | Status |
|----------|------|----------|--------|
| broker | 2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path | minor | Pending |
| planning | 2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md | major | Pending |
| broker | 2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it | minor | Pending |
| capture | 2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex | major | Pending |
| testing | 2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host | minor | Pending |
| capture | 2026-08-26-frame-exact-emulator-stop-is-unowned | major | Pending |
| docs | 2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability | major | Pending |
| store | 2026-08-28-phase-28-review-in-02-fsync-portability-on-windows | minor | Pending |
| store | 2026-08-28-phase-28-review-round-3-five-open-findings | blocker | Pending |

*The ledger was empty at the v0.4.0 close; every row above was filed after that
close (one on 2026-08-24, five on 2026-08-26, three on 2026-08-28), the first of
them the first pending todo since Phase 17 plan 17-01 emptied the tree. The
`phase-7-pitfall-5-…` row was filed by a `/gsd-explore` session and its ledger row was
added only after `docs-deferred-ledger.test.ts` direction A went red on it --
the third occurrence of that same file-without-row cause recorded in this
paragraph, which is itself the argument for filing the row in the same edit as
the todo rather than after the guard complains. The fifth row
(`back-05-…`) was added by plan 23-11 after `docs-deferred-ledger.test.ts`
direction A went red on it — the same guard, on the same cause, that plan 23-10
answered with commit `646d4d0` for the row above it. Filing a todo and adding its
row here are one action, not two. It is not optional bookkeeping:
`docs-deferred-ledger.test.ts` direction A requires an own-table-cell row here
for every file in `.planning/todos/pending/`, and that guard's own comment
recorded itself as "inert only because the pending tree is empty; a live risk
the moment a new pending todo is added". These rows are what keep it green now
that the tree is no longer empty.*

Not counted above, because they are complete on disk: all nine
`.planning/quick/` tasks the v0.3.0 pre-close audit reported as `[missing]`
(`260817-n6p`, `260818-nh5`, `260818-obc`, `260819-rop`, `260819-tsz`,
`260819-vie`, `260820-jwb`, `260821-a86`, `260821-jd8`) each carry a PLAN and a
SUMMARY; the audit reads `missing` because their SUMMARY frontmatter has no
`status:` field. (This paragraph named only the first four until the v0.3.0
close; the five added since are the same false positive, not new debt.)
Likewise the three UAT files reported as gaps that read `resolved` / `passed` /
`passed` (`03-UAT.md`, `08-HUMAN-UAT.md`, `08.1-HUMAN-UAT.md`).

Also carried, not blocking: roughly fifteen WR-class code-review findings across
five phases, enumerated per phase in
`milestones/v0.2.0-MILESTONE-AUDIT.md` → `tech_debt`. **WR-13 is no longer among
them** — Phase 15 plan 15-03 fixed it (commit `e9fa737`): `dispatchStock()`'s
miss branch now calls `capabilityRefusalMessage(name, "stock")` instead of the
locally-hardcoded "the fork backend provides this tool" wording, pinned by two
new invariant tests scanning every shipped module for either forbidden shape.
See the Phase 08 review-disposition backlog item, moved to
`.planning/todos/completed/` by Phase 15 plan 15-12, for the full
ten-finding disposition table.

Also carried, not blocking, from Phase 11.1's own disposition ledger (filed
under `.planning/todos/completed/`, dated 2026-08-21): the test-only
env hatch `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES` in `vice-proxy.ts` (narrow,
inert unless explicitly set, no user-facing surface); the comment-scope gap in
plan 11.1-01's phase-pointer guard (`r2000-project.ts`'s one comment-only
FLOW-02 site is permanently outside that guard's string-literal-only reach);
`r2000-cli.test.ts`'s harmless duplicate of `writeChain()`'s used-byte formula
(used only to build unrelated CLI fixtures, never to verify the DOS
convention). **`02-REVIEW.md`'s IN-05** (`stockReconnect()`'s thrown message
named the wrong function) is no longer carried here — Phase 15 plan 15-05
fixed it at source (commit `9849224`) and pinned it with a derived test; see
`.planning/todos/completed/` for the Resolution.

### Acknowledged at the v0.4.0 close (2026-08-23)

The pre-close artifact audit reported **16** open items. None is a requirement
gap, an integration gap, or an unverified phase — the v0.4.0 milestone audit
scored 16/16 requirements, 6/6 phases, 12/12 integration and 4/4 flows with zero
blockers. All 16 are bookkeeping: `status:` fields never flipped after the work
they describe landed, and quick-task directories left in `.planning/quick/` from
this and earlier milestones. They were **acknowledged, not resolved**, which sets
`closeout_type=override_closeout` for this close.

Acknowledgment is verdict-preserving and self-invalidating: it never rewrites an
artifact's own verdict, and the suppression lapses automatically the moment the
artifact's observed state changes again — an edited UAT gap or a reopened item
resurfaces at the next `audit-open` scan and must be acknowledged again.

**Counts:** 16 newly acknowledged, 0 carried forward from a prior close.

**v0.5.0 close (2026-08-25): 5 newly acknowledged, 16 carried forward from prior closes — 21 suppressed in total.** A further 13 rows the scanner had been reading as deferred items were NOT suppressed but corrected: they are evidence tables (guard exit codes in phase 19 item 2, the round-4 flake tally in item 6), over-read because that file's title is an `#` heading so the scanner treats the whole document as the Deferred Items section. They now carry an explicit `resolved` status column. The three genuinely-open entries above are load-induced test flakes, real and unfixed, carried forward rather than closed.

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| uat_gaps | 03/03-HUMAN-UAT.md | partial (0 pending scenarios) | 2026-08-23 | v0.4.0 |
| uat_gaps | 08/08-HUMAN-UAT.md | passed (0 pending scenarios) | 2026-08-23 | v0.4.0 |
| uat_gaps | 08.1/08.1-HUMAN-UAT.md | passed (0 pending scenarios) | 2026-08-23 | v0.4.0 |
| uat_gaps | 15/15-UAT-EVIDENCE.md | unknown (0 pending scenarios) | 2026-08-23 | v0.4.0 |
| quick_tasks | 260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i | unknown | 2026-08-23 | v0.4.0 |
| quick_tasks | 260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc | unknown | 2026-08-23 | v0.4.0 |
| quick_tasks | 260818-obc-live-prove-the-broker-mediated-monitor-h | unknown | 2026-08-23 | v0.4.0 |
| quick_tasks | 260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone | unknown | 2026-08-23 | v0.4.0 |
| quick_tasks | 260819-tsz-single-version-template-plus-resolver-sc | completed | 2026-08-23 | v0.4.0 |
| quick_tasks | 260819-vie-extract-release-stamp-zip-upload-into-on | completed | 2026-08-23 | v0.4.0 |
| quick_tasks | 260820-jwb-post-phase-9-repo-hygiene-ci-acme-timeou | unknown | 2026-08-23 | v0.4.0 |
| quick_tasks | 260821-a86-fix-phase-11-security-md-open-findings-w | unknown | 2026-08-23 | v0.4.0 |
| quick_tasks | 260821-jd8-close-wr-08-flag-shaped-option-values | unknown | 2026-08-23 | v0.4.0 |
| deferred_items | 07/deferred-items.md: `07-10` Route A `CPUHISTORY_GET` decode mismatch → its own Resolution entry records the corrected wire layout, the classification guard and the live 511,061-cycle proof, and states "Nothing from this entry remains open" | acknowledged | 2026-08-23 | v0.4.0 |
| deferred_items | 08.2/deferred-items.md: `D-1` `repo-root.test.ts`'s "not under .claude" assertion false-fails when the suite runs from inside a Claude Code worktree | acknowledged | 2026-08-23 | v0.4.0 |
| deferred_items | 16/deferred-items.md: `16-08` pre-existing `npm test` failures → both cascading guards went green when plan 16-10 landed (2386 tests / 0 fail), corrected in the entry itself | acknowledged | 2026-08-23 | v0.4.0 |
| uat_gaps | 18/18-HUMAN-UAT.md | passed (0 pending scenarios) | 2026-08-25 | v0.5.0 |
| todos | 2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path.md | (presence-only) | 2026-08-25 | v0.5.0 |
| deferred_items | 18/deferred-items.md: two load-induced full-suite flakes (broker-e2e, r2000-mcp-client) | acknowledged | 2026-08-25 | v0.5.0 |
| deferred_items | 19/deferred-items.md: vice-proxy.test.ts:1594 and :2260 concurrency flake | acknowledged | 2026-08-25 | v0.5.0 |
| deferred_items | 19/deferred-items.md: the same flake observed in a second file under 19-18 | acknowledged | 2026-08-25 | v0.5.0 |

**On the three `deferred_items` rows.** Two of the three read as genuinely closed
in their own text (07's Resolution and 16's orchestrator correction); they are
recorded `acknowledged` rather than `resolved` because promoting a verdict is a
stronger claim than this close is entitled to make on their behalf, and
`acknowledged` keeps them visible on this ledger. 08.2's `D-1` is a real standing
limitation, scoped and understood: `repoRoot()`'s `.git`-walk resolves a worktree
checkout under `.claude/worktrees/agent-*`, so the assertion trips only when the
suite is executed from inside a nested worktree — never in CI (`actions/checkout`
uses a plain path) and never in the main checkout. Hardening the test against
worktree execution remains new scope.

**Writer note.** The three `deferred_items` markers were written by hand rather
than by `query audit-open acknowledge`, which refuses this file shape with
`unsupported_heading_shape` (#3457) — the heading-delimited entry form, where the
CLI cannot map an entry back to an exact source span safely. The marker is the
per-entry `status:` field itself, so it self-invalidates identically. The other
13 were written by the CLI.

### Carried forward from earlier closes

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Defect | `Drive8Type=0` default on stock broker launch blocked all program loads (`.d64` and bare `.prg` alike) via `c64-ram-capture` (FINDING-C1); fix `-drive8type 1541` at launch | **Fixed** — Phase 8.2 plans 02-04 landed the fix, proved it live, and re-ran the walkthrough to a recorded `pass` | v0.2.0 Phase 8.1 (2026-08-19), fixed in Phase 8.2 (2026-08-19) |
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | **Closed** — v0.4.0 Phase 16 `PKG-02` gave all three scripts tests; `16-VERIFICATION.md` marks it ✓ SATISFIED | v0.2.0 scoping, closed in v0.4.0 Phase 16 (2026-08-23) as `PKG-02` |
| Quality | QUAL-02 — orphaned planning references in source comments | **Closed** — v0.4.0 Phase 16 `PKG-03` removed or repointed them and guarded against reintroduction; `16-VERIFICATION.md` marks it ✓ SATISFIED | v0.2.0 scoping, closed in v0.4.0 Phase 16 (2026-08-23) as `PKG-03` |
| Quality | QUAL-03 — emulator control-plane network exposure | **Closed as accepted risk, not narrowed** — v0.4.0 Phase 16 `PKG-04` (plans 16-02/16-11) recorded disposition `accept`: `PROJECT.md` → Key Decisions carries the dated (2026-08-22) row and `16-PKG04-EVIDENCE.md` grounds it in file:line citations plus a live observed bind (`0.0.0.0:19510`). The exposure itself still exists; REQUIREMENTS.md → `### Control-Plane Bind Follow-on` stays open owned work | v0.2.0 scoping, disposition recorded in v0.4.0 Phase 16 (2026-08-22), bookkeeping closed 2026-08-23 as `PKG-04` |

## Session Continuity

Last session: 2026-08-28T08:53:27.976Z
Stopped at: Completed 28-12-PLAN.md
  Plan 28-08 is complete: 2 tasks, 2 task commits (`6846492`, `f5805ae`), 21
  min. It is the SECOND of the three gap-closure plans (waves 5-7); 28-09 (gap
  3, CR-03's symlink confinement bypass) remains. **CR-02 is closed at the
  cause.** The `rmSync` + `vacuum into` pair that ran BEFORE `begin immediate`,
  outside any lock, on a path a committed pointer row already owned, is gone.
  The ring now has ONE OWNER PER PUBLISHED FILE: `stageSnapshot(handle, rev)`
  (exported, and exported for exactly one reason -- the ownership proof must
  drive the identical production code) vacuums into
  `snapshots/r<rev>.<pid>.<uuid>.tmp` and never names the published path;
  module-private `publishSnapshot` is the only `renameSync` onto
  `r<rev>.db` and runs only BETWEEN the won compare-and-swap and the
  pointer-row insert; module-private `discardSnapshot` runs on the CAS-failure
  path and the mutation-error path and is a safe no-op after a publication. The
  staging suffix is deliberately outside plan 28-07's `r<digits>.db` sweep
  pattern -- that anchoring is the live contract between the two plans and
  neither side may drift. The old comment's TRUE premise (`vacuum into` refuses
  an existing target; a revision number recurs after a revert) is KEPT and the
  reversal of its remedy recorded on `publishSnapshot`. **WR-11 closed**: the
  CAS-failure refusal reads the moved-to revision from `anno_meta` BEFORE the
  rollback and carries both `baseRevision` and `currentRevision`, pinned
  structurally with the reason for a structural pin stated in the test (the
  branch is not deterministically reachable -- `runWriteSequence` is
  synchronous -- and the reachable pre-transaction arm stays behaviourally
  pinned at `anno-store.test.ts:320`). **WR-04 closed**: `new DatabaseSync` and
  the fresh-store DDL block are both wrapped; a directory-as-path and a
  missing-parent path are refused with `AnnoStorePathError` inside the
  `ViceError` family, and a fresh-init failure rolls back and closes its
  connection. Two new edge probes: STORE-05 ordering (a refusal never reorders,
  renumbers or reinserts another process's rows -- in the connection AND after
  a close-and-reopen) and STORE-04 concurrency (the ownership proof). STORE-07
  extended without a second mechanism: `stageSnapshot` joins
  `applyWriteWithoutCommit` in `anno-seam.test.ts`'s no-shipped-module-names-it
  scan, generalised over a DECLARED two-element list with a paired length
  check, a RESTATED title and a loop-variable-built failure message (28-07's
  P12 applied to our own edit), plus a presence pin over all three staging
  transitions. FOUR observed reds, all reverted before their commits:
  `stageSnapshot` reverted to remove-then-vacuum-into-the-published-path
  (48/46/2, reddening the ownership proof on the staging-name inequality, then
  -- that arm neutralised -- on the buffer byte-identity, then on the revert);
  `currentRevision` removed from the CAS-failure options (52/51/1 on the WR-11
  pin); and the `DatabaseSync` constructor wrapping removed (52/50/2,
  `expected AnnoStorePathError, got Error: unable to open database file`). The
  third arm of the first red differs from the reviewer's own printed line
  because the test's own cleanup of its staging path IS, under the planting, a
  removal of the published file -- recorded verbatim rather than papered over.
  Gates: 115/115 across the six store test files, 36/36 on
  docs-review-disposition/hostpath-consumers/docs-linerefs/block-class,
  `tsc --noEmit` clean, `check-npm-packages` OK with 80/34 files unchanged. All
  four `anno-durability.test.ts` tests stay green, so the identical-code-path
  property WR-10 was accepted as designed on is intact. The whole-glob
  `npm test` was NOT run and is not a signal for this plan. Zero deletions.
  `STORE-04/05/07` stay `Gaps Found` on purpose -- gap 3 is still open against
  the same phase and `28-09` also declares `STORE-07`. Next: 28-09.

Previously stopped at: Completed 28-07-PLAN.md (gap closure: gaps 1 and 2 closed); next 28-08
  Plan 28-07 is complete: 2 tasks, 2 task commits (`6902301`, `ee4c256`), 16
  min. It is the FIRST of the three gap-closure plans (waves 5-7); 28-08 and
  28-09 remain. `28-VERIFICATION.md` gaps 1 (CR-01 + WR-02) and 2 (WR-01) are
  closed against all six of their `missing:` items, which discharges `28-06`
  truths 7 and 8 and removes `28-06` P9's flagged degradation. The invariant
  both gaps were routes into is now NAMED ONCE: a revision is RETAINED only
  when its `anno_snapshot` pointer ROW and its `snapshots/` FILE both exist,
  and `retainedRevisions()` is the single definition every consumer reads --
  `oldestRetainedRevision()`, `revertTo()`'s refusal, `reconcileSnapshotRing()`
  and through it `pruneSnapshots()`'s bound. The row-only
  `select min(revision)` query is gone. `reconcileSnapshotRing()` is the single
  half-state resolver, returns `{ droppedRows, droppedFiles }`, and is called
  at EXACTLY two sites -- the end of `revertTo` on the new handle and the start
  of `pruneSnapshots` -- and deliberately NOT from `openStore`, which would
  redden `anno-durability.test.ts:291-347`. `revertTo` now refuses an absent
  ROW or an absent FILE with the same named `AnnoStoreError` before touching
  the filesystem, stages and fsyncs BEFORE `closeStore` so a failure leaves the
  caller a usable handle (WR-02), and wraps every `node:fs` call so no raw
  `ENOENT` escapes the family; the one residual (a `renameSync` failure after
  the close) is STATED. The prune now deletes the POINTER ROW before it unlinks
  the FILE, and trap 10's inverted conclusion is corrected IN PLACE with its
  correct premise kept -- the verifier rated that comment a Blocker. Nine new
  tests including the phase's first second-revert and first mid-prune
  half-state scenarios. FOUR observed reds, all reverted before their commits:
  the `existsSync` filter removed from `retainedRevisions` (41/39/2, reddening
  both second-revert proofs); the prune statements swapped back to file-then-row
  (45/44/1 on the source-order control); and the directory sweep removed from
  the resolver (45/42/3 on half-state B's bound). Gates: 107/107 across the six
  store test files, 21/21 on hostpath-consumers/docs-linerefs/
  docs-review-disposition, `tsc --noEmit` clean, `check-npm-packages` OK with
  80/34 files unchanged. The whole-glob `npm test` was NOT run and is not a
  signal for this plan (~660 s, a `vice-proxy.test.ts` hang, 44-failure
  baseline). Zero deletions. `STORE-02/03/04` stay `Gaps Found` on purpose --
  gap 3 and CR-02 are still open against the same phase. Next: 28-08.

Previously stopped at: Phase 27 complete, ready to plan Phase 28
  Phase 27 is complete: 5 of 5 plans executed across 3 waves. Four seams now
  stand under non-`r2000` names (`acme-gate.ts`, `block-class.ts`,
  `prg-image.ts`, `shipped-modules.ts`) and the capability-or-glue record is
  committed as `module-classification.ts` (19 entries) with a 16-test enforcing
  guard whose non-vacuity threshold is DERIVED from the registry rather than
  pinned. `package.json`'s `files[]` gained exactly two entries for the whole
  phase; the three test-only new modules are absent. Criterion 4's evidence is
  in `27-05-SUMMARY.md`: broker confirmed stopped, full-glob `npm test`
  (`node --test '*.test.*'`) at 2636 tests / 2520 pass / 44 fail / 67 skipped,
  exit 1 — all 44 pre-existing and dispositioned (5 `r2000-session.test.ts`,
  39 `vice-proxy.test.ts`) with zero failures in any phase-27 file; typecheck
  and tarball validator green; ZERO deletions of any kind between `6c1f569` and
  HEAD. Two new open items in `deferred-items.md`: `D-27-02-A` (unclaimed) and
  `D-27-05-A` (`vice-proxy.test.ts` leaks two LISTEN sockets, so the whole-glob
  runner cannot exit unaided). Next: `/gsd-verify-work 27`, then
  `/gsd-plan-phase 28`.

Earlier: Phase 27 discussed, ready to plan
  `27-CONTEXT.md` and `27-DISCUSSION-LOG.md` written and committed (`6403e2f`).
  Four gray areas discussed, 17 decisions locked. Measured during the scout:
  `ci.yml` binds only the env var names, never the module path, so no functional
  CI edit was expected — confirmed by 27-01, which left `ci.yml` byte-identical.

Earlier: Phase 23 complete, ready to plan Phase 24
  Phase 23 is closed. The verdict `no-go` (rule `R1`) now gates Phase 24 through
  its ROADMAP `**Depends on**` line and Notes, this file points at
  `docs/phase23-real-release-gate-findings.md` rather than copying it, and the
  PROOF traceability reads 2 of 5 met — `PROOF-04` and `PROOF-05` Complete,
  `PROOF-01`/`PROOF-02`/`PROOF-03` Pending with the reason on the row. Six of
  eleven plans executed; 23-05..23-09 deliberately not dispatched. Zero product
  code across the whole phase; the full suite is green at 2593 pass / 0 fail.

Earlier in phase 23:
  Plan **23-02** provisioned the three instruments and ran the phase's tracer:
  one thin path through every layer — fetch, sha256 verify, build, assemble,
  run dxa, parse the listing, count bytes, run Ghidra headless, carve volatile
  blocks, export references — against the 279-byte fixture whose answer is
  published. dxa 0.1.5 is pinned (tarball `8e40ed77…826799` verified with
  `sha256sum -c` **before** `tar xzf`; binary `0e2bf1a5…c8523`) and vendored
  into `evidence/tools/dxa`, so `DXA-01` can later vendor the same build the
  gate measured. Three probe scripts landed and all three ran for real:
  `dxa-listing-parse.mjs` (the single `-a dump` parser, its byte-total refusal
  demonstrated firing on a truncated listing), `FlatVolatile.java` (four blocks
  after the carve, exactly two volatile, and the `.prg` branch proven from the
  same file), and `ExportAnalysis23.java` (the 400-reference cap gone, the
  classification count self-asserted, fired both ways).
  **The finding:** the fixture's published 141-code / 138-data ground truth is
  NOT derivable from `fixture.a`. Source gives 145 / 131 / 3-pad, so
  `FIXTURE_REPRODUCED: no` and the baseline is the source-derived 72.39% /
  3-FP / 27.61%. A fitted four-byte reclassification reproduces all four
  published figures exactly, and its direction is generous to dxa in precisely
  the place that produces the headline 0-false-positive claim — so **D-11's
  side-by-side is not apples-to-apples**, and 23-10 needs an operator ruling on
  which figures it prints. No corpus byte has been measured; 23-03 is still
  paused at its operator checkpoint.
Earlier still: **Completed 23-01-PLAN.md** — the gate pre-committed
  before any measurement existed: `DECISION-RULE.md` (`R1`..`R9`, first match
  wins, `R9` the only `go`), `SCHEMA.md` (68 outcome-line names with value
  domains, frozen) and `README.md` (the ten binding evidence conventions plus
  the banked `## Ordering proof`). The operator answered **`proceed`** at the
  Task 1 `blocking-human` gate. Both files are frozen — a later ambiguity is
  recorded as an `## ACCEPTED LIMIT` in the measuring plan's own evidence file,
  which is exactly what 23-02 then had to do four times.

Before that: v0.5.0 closed and archived 2026-08-25 — Phase 19
  complete, Phases 20-22 cut by the dxa+Ghidra pivot, milestone v0.6.0 opened
  and its 32 requirements defined.
Earlier: the Phase 18 discussion covered
  seven identified gray areas (session lifecycle & keying, crash-restart
  visibility, write serialisation, orphan & lease discipline, the D-32
  re-decision, surface-widening scope, `use_illegal_opcodes` forcing),
  producing 36 phase-local decisions in
  `.planning/phases/18-persistent-session-and-tool-surface/18-CONTEXT.md`.
  Load-bearing outcomes: the session is in-proxy, lazily opened, single-slot,
  invisible to callers, with no third spawn site; save-per-mutation is
  preserved byte-for-byte (the D-17/D-18 reversal changes process lifetime,
  not the durability contract); a coarse mutex serialises the whole
  mutate+save pair; `r2000_get_address_details` is composed client-side from
  the four curated reads and never calls upstream's defective tool, superseding
  D-32 with an issue-#42 reversal trigger; curated count moves 17 → 19. Three
  planted-violation gates are mandated (save-survives-SIGKILL, lost-update,
  settings-no-revert). Phase 18's plans are not written yet.
  Next: `/gsd-plan-phase 18`.
Earlier: **v0.5.0 roadmap created.** 27/27 requirements
  (SESS-01..04, SURF-01..03, ABS-01..04, COV-01..02, DECOMP-01..04,
  BUILD-01..06, EQUIV-01..04) mapped to five phases (18-22) in
  `.planning/ROADMAP.md`, with per-phase Goal/Depends-on/Requirements/Success
  Criteria plus a "Sequencing Rationale (v0.5.0)" section justifying the
  5-phase shape and EQUIV-01's placement. `.planning/REQUIREMENTS.md`'s
  Traceability table and Coverage block are filled in (27 mapped, 0 unmapped).
Earlier still: Milestone **v0.4.0 Debt discharged, decisions settled** closed and
  archived (2026-08-23). Six phases (12-17), 44/44 plans, 119 tasks, 16/16
  requirements. Final audit round 1, `tech_debt` — zero blockers, zero open
  gaps; the 16 items the pre-close artifact audit reported were acknowledged
  (see `### Acknowledged at the v0.4.0 close` above), making this an
  `override_closeout`. Roadmap, requirements and audit archived to
  `.planning/milestones/v0.4.0-*`; `.planning/REQUIREMENTS.md` removed via
  `git rm` and recreated by the next milestone. Phase directories were
  deliberately **not** archived: `docs-review-disposition.test.ts` asserts ≥150
  findings read out of `.planning/phases/` (and excludes
  `.planning/milestones/`), and `r2000-answer-key.test.ts` reads
  `.planning/phases/11-*/evidence/` unguarded — moving them would turn both
  red. Tagged `v0.4.0`.
Resume file: None

## Operator Next Steps

- Plan the gate: `/gsd-plan-phase 23` — The Real-Release Gate (Go/Degrade/No-Go)
- Before planning: secure the Phase 23 corpus. `c64-provenance-diff` runs against
  a *consuming* project's `recovery/` tree (`RELEASES.json` plus `.bin` dumps and
  their `.map.json` manifests); nothing in this repository is a real cracked
  release. If real releases cannot be obtained, that fact is a gate input, not a
  footnote — measuring on another self-authored fixture reproduces the exact
  defect `PROOF-01` exists to remove.

- Do not plan Phases 24, 25 or 26 until Phase 23's verdict is recorded.
