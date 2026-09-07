---
gsd_state_version: 1.0
milestone: v0.9.0
milestone_name: The Text Channel and the Runtime Evidence Layer
status: planning
last_updated: "2026-09-06T21:30:00.000Z"
last_activity: 2026-09-06
last_activity_desc: v0.9.0 roadmap created — Phases 39-44, 20/20 requirements mapped
stopped_at: v0.9.0 roadmap created 2026-09-06 — Phases 39-44; next is planning Phase 39, the dual-channel coexistence gate
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-06 at the v0.9.0 milestone open)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture
RAM, inspect chip state — and keep working when the emulator misbehaves.
*Confirmed still correct at the v0.8.0 close: the added engines sit downstream of
the live drive, so the ONE thing did not move — it acquired a measured floor.*

**Current focus:** Milestone **v0.9.0 The Text Channel and the Runtime
Evidence Layer**, opened 2026-09-06. Roadmap created 2026-09-06 — **six phases,
39-44**, continuing numbering from Phase 38 rather than resetting, with 20/20
requirements mapped and cross-checked mechanically. Nothing is planned or
executed yet; the next step is planning **Phase 39**, whose deliverable is
evidence rather than code.

Milestone scope, decided at the open: **claim the `-remotemonitor` text channel**
that `broker-launch.mjs:165` has appended to every stock launch since Phase 3 and
that nothing has ever dialed, behind a live probe of the one Unverified item
(whether a text client and a binary client can be connected at once without one's
halt/resume corrupting the other's view — bind-time coexistence is confirmed,
interleaved command behaviour is not); **parser seams** for `memmapshow`,
`prof flat`, `chis`, `bt` and `io`, one owning module per format with pinned
fixtures; a **runtime evidence layer in `.annostore`** holding run-keyed,
monotonically accumulating observations joined against the byte-derived block
table by a query that reports agreement *and* disagreement rather than
overwriting; **`PROOF-01`'s named reversal condition closed** by using
`memmapshow`'s execute bit as the independent execution oracle it shipped
without; and **`c1541` / `petcat` / `cartconv`** reached over v0.8.0's existing
`host_tool` control op.

**Out of scope by owner decision 2026-09-06:** VICE's text-monitor assemble and
disassemble (`a` / `d`), and `x64` ↔ `x64sc` mode switching — both become
available the moment the channel opens and both were declined on the spot.
**v0.8.0's exclusion "dialling the `-remotemonitor` text channel at all" is
deliberately reversed here**, superseded rather than deleted, and the risk it
named (the text monitor halts the machine on command, so it needs the same
serialization discipline `vice-sync.ts` holds for the binary side) is unchanged
and is now the gate on the first phase rather than a reason to stay out.

**Three claims from the exploration input are MEASURED FALSE and must not
re-enter scope**: VICE event record/replay does not exist (`event.c` has six event
options, none `-record`; `x64sc -record` exits 255) — it was v0.8.0's false
premise and had to be corrected mid-milestone, so run identity needs a different
mechanism; "text monitor as a concurrent first-class channel" collides with
stock's one-client rule and is precisely what the gate probes; and its flat warp
advice would erase a subtler recorded position rather than sharpen it.

**The rebuild half (`DECOMP-*`, `BUILD-*`, `EQUIV-*`) re-maps from v0.9.0 to
v1.0.0**, because the runtime-evidence layer is upstream of it: `DECOMP-01`'s
code-vs-data boundary guessing is what an execution oracle answers, and
`EQUIV-*`'s measured ceiling is one `chis`-on-3.9 may lift.

**Phase directories were deliberately NOT archived at the v0.7.0 close, and are
not archived at the v0.8.0 or the v0.9.0 open either.** Archival was tried at that close and measured
to redden 9 tests across 5 files, so the 28 directories under
`.planning/phases/` were restored and stay. `phases.clear` was therefore skipped
in the v0.8.0 open and skipped again in this v0.9.0 `/gsd-new-milestone` run — this is a measured project decision, not an
omission. v0.8.0's phases (33-38) landed alongside them and v0.9.0's (39+) will too — 34 directories now.

**Shipped:** v0.7.0 Own the Annotation Store — 2026-09-01 (6 phases 27-32, 80
plans, 214 tasks, 28/28 requirements, 690 commits, 7 days, `override_closeout`).
This project stopped renting its analysis state: The external analyser is deleted and
`.annostore` replaced it, reached through 18 `anno_*` tools registered
proxy-locally. **No milestone audit was run** — the third close in a row without
one, and the cost is named rather than absorbed: `STORE-03`'s traceability row
contradicts its own prose and ships unresolved, because Phase 29 routed it to
exactly the verification pass or audit this close did not run.

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
`override_closeout`). an external analyser session now survives many tool calls
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
**Before that:** v0.3.0 the external analyser static-analysis backend — 2026-08-21 (4
phases, 36 plans, 12/12 in-scope requirements, audit round 2 `passed`). Recon
findings are queryable state: 17 curated `anno_*` tools and 7 `vice-mcp anno`
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
from the external analyser, the five already-absorbed analysis procedures run on that
store, and the external analyser is deleted outright behind a gate observed biting.

**Two owner decisions taken at the open**, both narrowing v0.6.0's Phase 25 text:
**no parity is owed to the external analyser** — the "same facts" deletion gate and
`STORE-04`'s `ANNO-11` carry-across are both removed — and **the Phase 24 engine
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
v0.4.0 close; eleven were filed after it, two closed — CR-05 by Phase 34 plan 34-11, and
the Ghidra one-command decompile-wrapper proposal by Phase 36); the
suppressed/acknowledged rows are recorded in their own sections.

## Current Position

Phase: 39 of 44 — The Dual-Channel Coexistence Gate (Go/Degrade/No-Go) — not started
Plan: — (0 plans; Phase 39 not yet planned)
Status: Roadmap created, planning next
Last activity: 2026-09-06 — v0.9.0 roadmap created: Phases 39-44, 20/20 requirements mapped

**The first phase's deliverable is evidence, not code.** `CHAN-01`'s verdict
selects which of three structurally different serialization modules Phase 41
builds — an in-process mutex, a broker-level halt-authority lease, or a
connect-gate — so building any of them before the gate returns is rework by
construction. Phase 40 (`c1541` / `petcat` / `cartconv`) depends on neither the
verdict nor the channel and can run beside Phase 39 from day one.

## Performance Metrics

**Velocity:**

- Total plans completed: 320
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
| 28 | 23 | - | - |
| 29 | 21 | - | - |
| 30 | 6 | - | - |
| 31 | 4 | - | - |
| 32 | 21 | - | - |
| 33 | 12 | - | - |
| 34 | 11 | - | - |
| 35 | 5 | - | - |
| 36 | 7 | - | - |
| 37 | 8 | - | - |
| 38 | 4 | - | - |

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
| Phase 28 P13 | 12 min | 3 tasks | 3 files |
| Phase 28 P14 | 14 min | 3 tasks | 4 files |
| Phase 28 P15 | 8 min | 3 tasks | 2 files |
| Phase 28 P16 | 18 min | 3 tasks | 2 files |
| Phase 28 P17 | 16 min | 3 tasks | 2 files |
| Phase 28 P18 | 30 min | 3 tasks | 4 files |
| Phase 28 P19 | 38 min | 3 tasks | 4 files |
| Phase 28 P22 | 32 min | 3 tasks | 4 files |
| Phase 28 P23 | 32 min | 3 tasks | 5 files |
| Phase 29 P01 | 17 min | 3 tasks | 11 files |
| Phase 29 P02 | 41 min | 3 tasks | 9 files |
| Phase 29 P03 | 17 min | 3 tasks | 5 files |
| Phase 29 P04 | 25 min | 3 tasks | 5 files |
| Phase 29 P05 | 29 min | 3 tasks | 68 files |
| Phase 29 P06 | 71 min | 3 tasks | 4 files |
| Phase 29 P07 | 46 min | 3 tasks | 12 files |
| Phase 29 P08 | 9 min | 3 tasks | 5 files |
| Phase 29 P09 | 71 min | 3 tasks | 22 files |
| Phase 29 P12 | 19 min | 3 tasks | 5 files |
| Phase 29 P29-10 | 84 | - tasks | - files |
| Phase 29 P29-11 | 22 | - tasks | - files |
| Phase 30 P06 | 62 min | 3 tasks | 16 files |
| Phase 33 P01 | 20 min | 2 tasks | 3 files |
| Phase 33 P02 | 13 min | 2 tasks | 2 files |
| Phase 33 P03 | 66 min | 2 tasks | 3 files |
| Phase 33 P04 | 22 min | 3 tasks | 16 files |
| Phase 33 P05 | 22 min | 3 tasks | 5 files |
| Phase 33 P06 | 33 min | 2 tasks | 14 files |
| Phase 33 P07 | 22 min | 3 tasks | 6 files |
| Phase 33 P08 | 38 min | 2 tasks | 6 files |
| Phase 33 P09 | 42 min | 2 tasks | 6 files |
| Phase 33 P10 | 33 min | 3 tasks | 5 files |
| Phase 33 P11 | 3h 37m | 3 tasks | 8 files |
| Phase 33 P12 | 21 min | 3 tasks | 5 files |
| Phase 34 P01 | 40min | 3 tasks | 16 files |
| Phase 34 P02 | 26min | 2 tasks | 3 files |
| Phase 34 P03 | 31min | 3 tasks | 10 files |
| Phase 34-the-host-tool-execution-seam P04 | 59min | 3 tasks | 14 files |
| Phase 34-the-host-tool-execution-seam P05 | 55min | 3 tasks | 5 files |
| Phase 34 P07 | 26min | 2 tasks | 7 files |
| Phase 34 P08 | 30min | 3 tasks | 7 files |
| Phase 34-the-host-tool-execution-seam P09 | 27min | 3 tasks | 8 files |
| Phase 34 P10 | 25min | 3 tasks | 3 files |
| Phase 35 P01 | 55min | 3 tasks | 37 files |
| Phase 35 P02 | 40min | 2 tasks | 2 files |
| Phase 35 P03 | 55min | 3 tasks | 8 files |
| Phase 35 P04 | 45min | 3 tasks | 7 files |
| Phase 35 P05 | 17 min | 3 tasks | 4 files |
| Phase 36 P01 | 41min | 3 tasks | 14 files |
| Phase 36 P02 | 35 min | 3 tasks | 6 files |
| Phase 36 P03 | 31min | 3 tasks | 9 files |
| Phase 36 P04 | 30min | 3 tasks | 5 files |
| Phase 36 P05 | 48min | 3 tasks | 4 files |
| Phase 36 P06 | 55min | 3 tasks | 3 files |
| Phase 36 P07 | 62min | 3 tasks | 5 files |
| Phase 37 P01 | 60min | 3 tasks | 12 files |
| Phase 37 P02 | 75min | 3 tasks | 8 files |
| Phase 37 P03 | 45min | 3 tasks | 4 files |
| Phase 37 P04 | 35min | 3 tasks | 4 files |
| Phase 37 P05 | 24min | 2 tasks | 3 files |
| Phase 37 P06 | 30min | 3 tasks | 9 files |
| Phase 37 P07 | 18min | 2 tasks | 4 files |
| Phase 37 P08 | 48min | 3 tasks | 17 files |
| Phase 38 P01 | 27min | 2 tasks | 7 files |
| Phase 38 P02 | 50min | 2 tasks | 3 files |
| Phase 38 P03 | 24min | 2 tasks | 2 files |
| Phase 38 P04 | 34min | 2 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Close v0.2.0 audit items: UAT walkthrough + planning-doc drift (URGENT)
- Phase 8.2 inserted after Phase 8.1: Close v0.2.0 blockers: stock drive-config defect, red test gate, walkthrough re-run (URGENT)
- v0.3.0 opened as Phases 9-11, continuing v0.2.0's numbering rather than resetting to 1.
- v0.3.0 re-split from two phases to three: `ANNO-16`'s assumption probe was
  promoted out of Phase 9's body into a standalone go/no-go phase. Its failure mode
  is *reconsider the milestone*, not *replan the phase* — if the external analyser cannot
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
  the two engines (24), the annotation store and the anno cutover (25), and
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

- **v0.9.0 opened as Phases 39-44 (2026-09-06)**, continuing v0.8.0's numbering
  rather than resetting to 1, and landing alongside the 34 phase directories
  already under `.planning/phases/` — which are deliberately not archived, a
  decision re-measured at the v0.7.0 close where archival reddened 9 tests
  across 5 files. **Six phases at `standard` granularity**, the same count
  v0.7.0 and v0.8.0 each reached, derived from the work rather than matched to
  them. Research proposed ten items; four are not phases here. Two are
  planning-only decision records folded into the phases that touch the relevant
  code — the `.annostore` schema-bump question is `EVID-02` and rides with
  Phase 43, and the `c1541`-supersedes-`d64-parse.mjs` question is already
  deferred to Future Requirements and needs no phase at all. The other two are
  not separable deliveries: the text dispatch layer is what `CHAN-03` means by
  "a user's tool call can reach the text monitor", and the wedge-triage skill
  update is `CHAN-05`, which may not ship a phase later than the hazard it
  covers.

- **v0.9.0: the coexistence probe is a phase, for the fourth time in this
  project's history and the first three all fired.** `CHAN-01`'s verdict selects
  which of three structurally different serialization modules Phase 41 builds —
  in-process mutex, broker-level halt-authority lease, or connect-gate — so a
  note inside a larger phase would make the gate skippable while a phase
  boundary makes it structural. Phase 9's `R4` returned `degrade`; Phase 23's
  `R1` returned `no-go` and five plans were never dispatched; Phase 33's `R6`
  returned `degrade` with the one available override declined. Phases 41-44 each
  state what they become under each verdict rather than assuming the favourable
  one.

- **v0.9.0: `EVID-06` is an exit criterion of Phase 43, not its own phase, and
  the line is stated so the choice is checkable.** It carries the full gate
  discipline — pass/fail rule fixed before the measurement — and runs at the
  *head* of Phase 43, before the schema is settled, because retrofitting an
  instrumentation axis onto a shipped run-identity key is the rework the
  discipline exists to prevent. What it does not do is narrow or cancel a later
  phase: both outcomes keep Phase 43's scope, selecting a labelling policy
  inside it. That is the property Phases 9, 23 and 33 all had and `EVID-06` does
  not.

- **v0.9.0: `PROOF-04` is its own phase despite being a single requirement.** A
  measurement phase must be free to close on `not-exercised`, which Phase 38 did
  for `PROOF-02`. Folded into Phase 43 it would sit behind that phase's
  shipped-code pass, where a green build can launder a weak measurement.

- **v0.9.0: three new Standing Constraints added to ROADMAP.md at the roadmap's
  creation**, each a hazard that fails *silently*: monitor-output format drift
  is semantic rather than syntactic (3.4 inverted `mc`/`ms`'s glyph meaning with
  no syntactic change); the text monitor halts the machine on command, so it is
  a second channel needing the same serialization discipline and a contended
  instance must not be diagnosed as wedged; and `c1541` and `cartconv` exit `0`
  on error, so an exit-status check over them passes failures silently.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 37 (`CR-01`): the recovered const-write facts round-trip through the TWO-CALL
  tool surface — `anno_import_ghidra_export` returns them, `anno_join_memmap` accepts
  them back as `const_writes` — rather than being persisted in the store. `STORE-05`
  reserves the `bank` column with nothing interpreting it, so widening it inside a
  review fix would have been a design change in disguise. Logged in PROJECT.md.

- Phase 37: the six required observed-red controls are each their OWN task with its own
  commit, never batched — `.planning/research/PITFALLS.md` § Pitfall 23 names batching
  them into "the controls are in place" as the exact failure mode. Plans 37-04, 37-05
  and 37-06 each carry the reds for rules landed in an EARLIER plan, on purpose.

- Phase 37 (37-02): `bank.a` was MEASURED to be straight-line code with no
  path-dependent `$01` site, so a decline control against it would have passed for the
  wrong reason. A synthetic two-caller fixture was built as an early task instead of
  reusing the existing one.

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
- [Phase 09-01]: Human authorized cargo install analyser and tmux install at a blocking checkpoint; both performed by the human, never by this agent (its own tool-permission classifier denies cargo install outright)
- [Phase 09-01]: The external analyser 0.9.20's real toolchain floor is rustc >=1.88 (transitive, undeclared in Cargo.toml), not edition 2024's 1.85; --locked does not work around it; rustup update stable (1.85.1->1.97.1) was a human-authorized host change
- [Phase 09]: Go/no-go verdict recorded: **`degrade`**, rule **`R4`** fired (triggering input: `c3_4_vsf_load: partial`), against installed **the external analyser 0.9.20**. Full evidence, all seven criteria and the reproduced decision rule live in one place: `docs/phase9-external-analyser-probe-findings.md` (frontmatter `verdict`/`verdict_rule_applied`/`criteria`) — read there, not restated here.
- [Phase 09-08]: Ran sequentially on main with no worktree isolation, per this plan's own worktree: false frontmatter -- its deliverable IS STATE.md/ROADMAP.md content, which worktree mode strips from executor commits
- [Phase 09-08]: Added a ROADMAP Phase 11 Notes pointer to the findings document even though the verdict produced no scope amendment there, because Phase 11's own pre-existing Notes anticipated a criterion-3(3) format-mismatch contingency that needed an explicit answer (it did not fire)
- [Phase 11-03]: Ran sequentially on main with no worktree isolation, per this plan's own worktree: false frontmatter -- its deliverables ARE .planning/ROADMAP.md/REQUIREMENTS.md content plus two todo-file git mv moves, which worktree mode strips from executor commits
- [Phase 11-03]: Reworded ROADMAP.md's Phase-10-criterion-3 .vsf note from 'Phase 11 confirmed this (D-34)' to 'confirmed by D-34' after the literal string 'Phase 11' on a .vsf-mentioning line tripped the acceptance grep gate that checks no document still names Phase 11 as .vsf's home -- same meaning, mechanically clean
- [Phase 11.1]: D-11.1-01: both anno-cli.ts .vsf surfaces reworded to name .planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md instead of a phase; a committed character-state-machine guard (docs-dangling-refs.test.ts) now fails if any shipped string literal names a phase number
- [Phase 11.1-02]: D-11.1-02: gen-enums, export-lbl, import-lbl documented in c64-memory-mapping/c64-program-recon; the symbol round trip documented as one closed loop matching Phase 11's live walkthrough, not two one-way dumps
- [Phase 11.1-02]: check-skill-tool-coverage.mjs's anno CLI verb list is parsed from anno-cli.ts's dispatch switch (scripts/lib/anno-cli-verbs.mjs), never hand-typed -- proven non-vacuous by a committed planted-violation test
- [Phase 11.1-03]: INT-01/D-11.1-03 -- hostpath-consumers.test.ts's anno absence list is now readdirSync-derived with a floor (>= 14) rather than a hard-coded 10-name array; the four previously-uncovered modules (anno-acme-ident.ts, anno-regbits-gen.ts, anno-symbols.ts, anno-test-gate.ts) are now covered and confirmed clean
- [Phase 11.1-03]: Phase 10 IN-02 -- the hostpath.ts import detector now matches the whole comment-stripped source with the m flag (catching multi-line named imports) plus a dedicated dynamic-import pattern (catching await import(...)), each proven by a committed planted-violation test
- [Phase 11.1]: D-11.1-04 (WR-10): default runAnno() timeout 120s, maxBuffer 32 MiB, proven live against real the external analyser 0.9.20 (38/38 pass) and the timeout proven real via a separate child process.
- [Phase 11.1]: D-11.1-05 (INT-02): anno-launch.ts's header corrected to name anno-mcp-client.ts as a second, necessary async spawn site; ANNO-01's guard-before-spawn invariant is now checked by spawn-seam.test.ts over the shipped module set (package.json files[]), not a raw directory listing, to exclude anno-test-gate.ts's legitimate --version probe.
- [Phase 11.1]: D-11.1-06 (Phase 11 IN-02): regenerateAndReload() marked library-only rather than given an invented caller; a biconditional guard in anno-symbol-roundtrip.test.ts ties the LIBRARY-ONLY marker to the real production-caller count in both directions.
- [Phase 11.1]: 11.1-05: WR-11 pinned bidirectionally via fileClaimViolations(); IN-03's isStandaloneDisasmToken() excludes hyphen-adjacent-letter shapes to stop false-positiving on Phase 4's disasm-*.ts; IN-01's drained/bounded process.exit() also fixed a self-inflicted EPIPE-crash regression, using a test-only env-var hatch since neither plan-named payload route scales past ~220 bytes on this host's the external analyser
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
- [Phase 15]: Phase 15 plan 15-07 fixed three cheap pending todos: build-atomic.test.ts's cleanup-scan flake (private wrapper dir, proven by planted violation, commit 7484afa), cpuhistory-get*/cpuhistory-get-multi.json's mislabelled fork-as-stock capturedFrom (commit d67f0ef, derive-the-kind follow-on named rather than fixed since it touches evidence-immutable probe-binmon.mjs), and the hand-copied ACME/analyser gate migration onto anno-test-gate.ts across three files (commit 185187a), proven by a measured before/after pass-count table identical in every cell
- [Phase 15]: Phase 15 plan 15-09: GAINS-PROTOCOL.md's warp error codes corrected to the measured 2026-08-20 stock-3.10 values (0x01 object-does-not-exist, 0x8f only for int-typed set); vice_machine_config_set's WarpMode caveated fork-only in docs/stock-vice-parity.md and capability-registry.ts (existing fields, no schema growth); vice_ping's resolvedBinaryPath documented as a startup-time probe with a new backward-compatible resolvedBinaryPathScope field. Both pending todos closed; STATE.md ledger reconciled (pending 12->10, total 13->11).
- [Phase 15]: [Phase 15-10]: A4 (the D-11 rate-limiter's setImmediate() auto-disable deferral) live-tested against genuine stock VICE (KERNAL IRQ at $EA31, ~21 observed hits/sec) and CONFIRMED for the rates and host tested -- auto-disable fired, wire-side enabled flag independently confirmed false, emulator kept progressing; probe-debt todo closed with all five original assumptions accounted for
- [Phase 15]: [Phase 15-10]: 03-HUMAN-UAT.md's last pending scenario (scenario 3) closed pass, citing 15-A4-PROBE-EVIDENCE.md; file now carries zero result: [pending] rows, status stays partial (scenario 2's joystick half remains an honest negative result)
- [Phase 15]: [Phase 15-11] vice_disk_attach's approximation string and docs/stock-vice-parity.md's D-14 bullet both corrected to state the real reset-plus-load behaviour Phase 13's A5 probe observed; the plan's own claimed second disagreeing site at :311 was verified and found unrelated (a different D-14).
- [Phase 15]: [Phase 15-11] tools-manifest.json staleness todo disposed wont-fix on the D-16 ground (deliberate deletion, not staleness); fork-live.test.ts's live-surface diff now names D-16 explicitly via a new shared fork-deleted-tools.ts constant, never a second hand-typed list.
- [Phase 15]: [Phase 15-11] CI test-command divergence settled keep-npm-test from GitHub Actions run 32517575905's own log (all nine MANUAL_ONLY_TESTS suites pass cleanly in under two minutes); documented in ci.yml's Test-step comment citing the run id, naming zero manual-only test filenames.
- [Phase 15]: [Phase 15-11] vice_disk_attach's contract-redesign question promoted to REQUIREMENTS.md Future Requirements with plan 15-12 named as owner, not implemented here; REQUIREMENTS.md itself untouched by this plan.
- [Phase 15]: [Phase 15-12] Closed the phase's record: Phase 08's ten review findings (WR-04..WR-13) transcribed with resolvable commits into one Resolution table; broker-tests-stall and .vsf-bootstrap-input todos closed wont-fix; keyboard-fallback-load todo promoted with a named owner (plan 15-08's live evidence met neither of the two closing conditions this plan named); GATE-02/DEBT-01/DEBT-02/DEBT-03 flipped Complete with closure notes; pending-todo count reduced from 21 (as of 15-01) to 2, both remaining items promoted to Phase 16 (PKG-01, PKG-03)
- [Phase 15]: [Phase 15-01, restated by 15-12's phase-close] The widened guard's two new invariants: a shape-drift detector (declaredFindingIdsInHeadings(), anchored at any heading level 1-6, whose output must be a subset of the narrower parser's) so a future fifth heading shape fails a named test instead of silently vanishing; and a fixture-driven regression test (planted WR-98/IN-97 shapes in fixtures/planted-review-fixture.md) pinning the two previously-invisible shapes against a committed fixture
- [Phase 16]: Phase 16 plan 01: skills relocated to src/skills/; D-16-02 accepted losing in-repo autoload, documented two consumer routes in README.md; found and fixed 3 out-of-scope functional path literals (anno-regbits-gen.ts MEMMAP_PATH family) that the plan's own consumer enumeration missed
- [Phase 16-packaging-and-repo-shape]: Accept broker control-plane 0.0.0.0 bind (PKG-04) rather than narrowing it — The bind exists so a containerised consumer dialing host.docker.internal can reach the broker; narrowing without a replacement route would be a regression. Compensating control: 256-bit token, timingSafeEqual, mode-0600 broker.json. Recorded in PROJECT.md Key Decisions with a named smart-default follow-on.
- [Phase 16]: 16-03: PKG-01 merge half verified rather than rebuilt -- wireMcp() already implemented correct merge semantics; added 18 node:test cases (in-process happy paths + subprocess-driven refusal paths via an entry-point dispatch guard) pinning it against the shipped cli.mjs, zero new dependencies — The pending todo's own Solution step 4 asked for exactly this test; a malformed-config refusal was the security research's named tampering mitigation and was previously unasserted
- [Phase 16]: Phase 16 plan 04: relocated the MCP server package (@henols/vice-mcp) from .claude/mcp/vice/ to src/mcp/vice/ in one atomic git mv; repoRoot()'s branch-4 hop count reviewed and left unchanged (same 3-segment depth); found and fixed 3 functional literals plus ~22 stale .claude/skills self-references that plan 16-01's own sweep missed; published tarball proven byte-identical to the pre-move baseline — PKG-01's second, larger half -- the same relocation machinery plan 16-01 proved on the skills tree, driven through the ~180-file vice-mcp package
- [Phase 16]: Phase 16 plan 16-06: PKG-02 closed -- all three previously-untested skill CLI scripts (acme.mjs, driver.mjs, derive.mjs) now have committed, discovered test coverage (47 new tests: 16+17+14); a driver.mjs .d.mts declaration file was tried and reverted after it leaked into the installer npm tarball, replaced with a scoped @ts-expect-error on the one import line instead; parseAddr()'s null-address branch confirmed unreachable through the shipped (unexported) surface, pinned to its nearest reachable observed proxy rather than invented or fixed by editing the script.
- [Phase 16]: PKG-03: comment-scoped orphaned-phase-pointer guard built; 15 sites + 2 test decision-id strings repointed at existing permanent records; fixture + gate-proof committed — Cut-phase citations must name the phase, not its number (re-tripping risk); matching is per-physical-line, not per-span, to avoid cross-line false positives measured in the real corpus
- [Phase 16]: Phase 16 plan 05: swept CLAUDE.md/README.md/docs/*.md path references to relocated src/ trees; re-verified all four vice-proxy.ts line citations unchanged; fixed a pre-existing acme-build Project Skills table description drift; left one 2026-08-12 command transcript in docs/phase1-probe-results.md untouched as historical record
- [Phase 16]: [Phase 16-08]: Leak assertions promoted into assertLeanTarball(), invoked from inside packFiles() so no packed package skips the check; the packed-package name set is pinned to exactly two names so a third package cannot be packed unchecked.
- [Phase 16]: [Phase 16-08]: ci-suite-coverage.test.ts fixed a self-inflicted regression in ci-guardrails.test.mjs (its npm-test-step assertion assumed exactly one such step existed repo-wide); scoped to working-directory: src/mcp/vice.
- [Phase 16]: [Phase 16-08]: Two pre-existing npm-test failures (docs-review-disposition.test.ts, audit-integrity.test.ts) tripping on 16-REVIEW.md's own undispositioned findings, confirmed via git stash to predate this plan; logged to deferred-items.md as out of scope, expected closure at 16-11.
- [Phase 16]: [Phase 16-09]: hop-chain-comments.test.ts built as a fixture-pinned, per-line structural guard against WR-02's defect class (a comment splicing a current path-chain segment onto pre-relocation intermediate segments); demonstrated RED against both real violations before fixing them. anno-regbits.test.ts's two scratch-tree segment lists and .gitignore's canonical-source comment renamed to the current src/mcp/vice / src/skills shape (behaviour-neutral, proven by the drift guard's own unequal digests). SUMMARY deliberately avoids naming 16-REVIEW.md's OTHER open finding by its literal id token, since docs-review-disposition.test.ts's disposition check is a bare-word presence scan that would otherwise falsely close it -- that finding stays open, owned by plan 16-10.
- [Phase 16]: 16-10: Reverted CR-01 consumer-path regression (renderLedger/anchor-search/renderLoading/template.a/SKILL.md), shipped skill-consumer-paths.test.ts as a frozen four-entry registry guard against the class recurring; docs-review-disposition.test.ts and audit-integrity.test.ts confirmed fully green (2386/2342/0/39/5) for the first time this phase
- [Phase 16]: [Phase 16-11]: PKG-04 flipped to checked/Complete in REQUIREMENTS.md with a closure note citing PROJECT.md's dated accepted-risk row and 16-PKG04-EVIDENCE.md, explicitly preserving the open Control-Plane Bind Follow-on; PKG-01 given a companion closure note naming plans 16-08/16-10
- [Phase 16]: [Phase 16-11]: New decision register 16-GAP-CLOSURE-DECISIONS.md records five deliberate non-reversals with owners/reversal triggers (four SKILL.md quick-references, recovery-schema.mjs, project-paths.mjs, repo-root.test.ts, and 16-REVIEW.md's IN-01 recorded as renamed-not-left by plan 16-09), the spec-less probe's four-item accounting (two authored, two flagged unresolved), the three recalled prohibitions, and five newly-found sites with their closing plans
- [Phase 17]: Dropped docs-deferred-ledger.test.ts's non-vacuity pending floor to no floor at all (not a smaller nonzero number), since 0 pending is DEBT-04's own success criterion, and made the positive control conditional on pending.length > 0 (selecting its stem from the live pending array instead of a hard-coded filename) — The previous floor of 2 could not express a genuinely empty pending tree; the guard's own prior-author comment named this exact phase as the one that might need to lower it further
- [Phase 17]: STATE.md's Deferred Items ledger now reads the true v0.4.0-close count of 0, derived from and agreeing with the empty .planning/todos/pending/ tree — Phase 16 discharged both remaining pending todos (PKG-01, PKG-03); the ledger text was stale by exactly those two rows until this plan's Task 2
- [Phase 17]: CORE-01 decided keep-dated at plan 17-02 task 1's blocking-human checkpoint, delegated by the human to the orchestrator, recorded in PROJECT.md → Core Value dated 2026-08-23 — The checkpoint was rendered and the operator answered 298 seconds later in free text `you decide` rather than selecting an option; attendance and delegation are on the record, comprehension is not evidenced by any artifact and is not claimed (corrected 2026-08-23 by plan 17-04, gap G-17-1); orchestrator selected keep-dated on ANNO-01's structural VICE-incapability argument and v0.4.0's lack of new evidence
- [Quick 260823-kf6]: Flipped QUAL-01/QUAL-02/QUAL-03 to Closed in STATE.md's carried-forward ledger, naming PKG-02/PKG-03/PKG-04; reconciled STATE.md's Deferred Items prose and REQUIREMENTS.md's DEBT-04 note to the one genuinely surviving open row (UP-01/UP-02) — corrects v0.4.0-MILESTONE-AUDIT.md round-1 tech-debt cluster 1
- Roadmap (v0.5.0): the coverage instrument (Phase 19) and the reassembly-plus-hazard-report gate (Phase 21) are both sequenced before the work they measure (Phase 20's decomposition sweep, Phase 22's equivalence/modifiability demo respectively) — mirroring v0.4.0's audit-gate-first precedent (Phase 12). EQUIV-01 (compare.mjs's original-vs-different-binary extension) is flagged as the milestone's single highest-risk requirement and sequenced as Phase 22's first success criterion rather than split into its own phase.
- [Phase 18]: 18-01: Ran the Architecture Change Procedure's six steps for the D-17/D-18 reversal in ARCHITECTURE.md; allocated D-36 superseding D-32; pinned both with docs-absorbed-decisions.test.ts, proven non-vacuous by three live planted-violation probes
- [Phase 18]: ensureProjectSettings() shares ANNO_SYSTEM_C64 with synthesizeProject() (D18-33); forces use_illegal_opcodes silently but refuses by name on a settings.system mismatch (D18-34).
- [Phase 18]: [Phase 18-03]: Promoted openAnnoSession()/AnnoSession (anno-mcp-client.ts) and built anno-session.ts's single-slot lifecycle owner; runAnnoTool() rewired through runInAnnoSession() with its call-then-save body byte-identical; D18-09's three-scenario save-discipline gate landed live and watched red-then-green against real production code — While proving this plan's own npm test full-suite acceptance criterion, found and fixed a real cross-session staleness bug: a held session could answer from stale in-memory state after anno-symbols.ts's importLabels() (a deliberately separate one-shot session per D18-07) saved to the same project file -- fixed via a project-file mtimeMs comparison before every reuse. Also diagnosed (but did not fix, per scope-boundary) a pre-existing, unrelated npm test hang affecting anno-cli.test.ts and three siblings when the external analyser is installed locally -- logged to deferred-items.md and WINDOWS.md.
- [Phase 18]: SESS-02 restart policy: crash counter is scoped per project path, resets only on explicit test reset or project-path change (never on success), bounded by DEFAULT_ANNO_RESTART_BUDGET=3 (env-overridable via ANNO_RESTART_BUDGET)
- [Phase 18]: D18-23 (SIGKILLed-proxy orphan risk) answered by measurement: The external analyser 0.9.20 self-terminates within ~200ms of stdin EOF with no exit hook running -- no startup sweep filed
- [Phase 19]: Phase 19 elects MIT from the external analyser's dual MIT OR Apache-2.0 for all absorbed prose; the Apache-2.0 modification notice is discharged by each per-file ADAPTED, NOT VERBATIM header regardless
- [Phase 19]: D18-16 CLOSED by measurement: The external analyser 0.9.20's --mcp-server-stdio does not multiplex (3 runs + source proof), so the coarse FIFO mutex stays and a reader-writer upgrade would buy zero parallelism
- [Phase 19]: Census assertions in packaging CI are relations against src/skills/, never literals — check-npm-packages.mjs now compares tarball skill count to topLevelSkillDirs() with a >=6 non-vacuity floor
- [Phase 19]: All five upstream analyze procedures are now absorbed, so ABS-01 and ABS-02 flip to Complete, reversing 19-01's deliberate rollback
- [Phase 19]: One attribution block per SOURCE PATH, not per file: c64-memory-mapping and c64-program-recon each absorb two procedures with two different digests, and a single per-file header could only claim one of them
- [Phase 19]: The bare disasm token is banned corpus-wide by check-skill-fork-honesty.mjs (a removed acme verb) with its exemption count pinned at exactly 1, so absorbed read-region steps omit the view parameter and rely on its documented default rather than growing the exemption
- [Phase 19]: Coverage report schema pinned as flat sibling measure objects (checkpoint option flat-three, auto-selected under yolo mode): each measure addressable by a stable top-level key, schema test is a plain key-set assertion, and no aggregate is one reduce away — COVERAGE_SCHEMA_VERSION = 1 with nine top-level keys is the contract Phase 20 reads throughout its sweep and Phase 21 reuses for its hazard report; a rename must bump the version deliberately
- [Phase 19]: COV-01 reproducibility uses a bytes-versus-store independence axis, not a second agent session — Nested headless agent sessions stall indefinitely in this environment, so the runnable independence is that neither route reads the other route input; the committed sha256 seal is what prevents retrofit, and a live test recomputes both routes from the fixture on every run
- [Phase 19]: The census reads the external analyser own block table at exactly one call site, the divergence sub-report, and never as a measure of completeness — Upstream follow_indirect_jumps walks only bytes already classified Code through pointers already classified Address, so on an under-classified binary it finds nothing; a store-derived census would report nothing-left-to-do on an untouched binary
- [Phase 19]: The coverage verb reuses runAnnoTool() rather than opening its own session: reads share the one held the external analyser child, and the curated-tool assertion plus resolveStorePath() stay on the path. No new child-process site (T-19-25).
- [Phase 19]: Coverage exits 0 for any report it could build, however poor the numbers; non-zero is reserved for a caller error, an unreadable store, or an undecodable payload. A bad score is a result, not a failure.
- [Phase 19]: Cross-reference lookups are bounded at 512 non-System labels and the bound's effect is PRINTED whenever it bites, so a partial population never reports as the whole one (COV-02).
- [Phase 19]: Packer identity ships as a project-owned skill script, never an anno_-prefixed tool: that prefix asserts the external analyser serves it, and no such tool exists upstream at the pin.
- [Phase 19]: The packer name has exactly one assignment site in the module, inside the external-oracle branch; the high confidence level likewise. Both counts are asserted at source level by the colocated test.
- [Phase 19]: An absent packer oracle is a VISIBLE skip by default and a hard failure under VICE_REQUIRE_UNP64 (demonstrated: exit 1). Absence never reads as a passing SURF-03.
- [Phase 19]: An eighth anno CLI verb moves FOUR counts, not three: the dispatch switch, ANNO_CLI_VERB_FLOOR, REAL_VERBS, and anno-cli.test.ts's VERB_OPTIONS length assertion. All four now carry comments saying so.
- [Phase 19]: ABS-03 closed on a gate green over SHARPENED descriptions, not a weakened one: threshold untouched, allowlist empty, no skill excluded; observed inventory maximum 0.250 against an inclusive 0.35
- [Phase 19]: The absorbed procedures are a SNAPSHOT at commit 493f8404 (53,392 bytes, five paths); re-sync is a hash comparison mechanised by the manifest's resync_triggers, triggered by any move off the external analyser 0.9.20 or any change to anno_get_binary_info's field set
- [Phase 19]: anno_toggle_splitter (DECOMP-01, BUILD-02) and anno_set_immediate_format (IS BUILD-03) are PROPOSED in Phase 19 and implemented at the start of Phase 20 -- the absorption diff acted as a requirements-discovery instrument
- [Phase 19]: SURF-03 closes on a NEGATIVE result stated as one: the bar is a project-owned route that never guesses, not a name reported on this machine; upstream's signature table deliberately not copied and no invented name placed on the anno_ prefix
- [Phase 19]: D18-16's reader-writer deferral is CLOSED by measurement -- the child reads serially, so the coarse FIFO mutex is an exact model rather than a compromise; the anno-tools.ts cursor-tool invitation is answered in the same decision and the trio stays held
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
- [Phase 19]: A green gate does not close an intermittent failure — the anno-session 200ms stub flake stays open at 2 red in 6 full-suite runs, owner a plan that owns anno-session.ts
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
- [Phase 27]: No re-export shim left in anno-project.ts, and the six remaining importers were repointed in the extraction commit itself — A shim leaves the coupling fully intact while looking finished. And because tsc --noEmit is whole-project (tsconfig include is **/*.ts), any commit that removes the exports without repointing every importer is a tree that does not typecheck -- itself a partial repoint. Deviation Rule 3.
- [Phase 27]: anno-cli.test.ts deliberately left untouched: measured, no comment in it attributes either moved function to the old module — The plan expected two comment-accuracy files. All seven parser mentions in anno-cli.test.ts either name the function bare or attribute it to anno-cli.ts own header, so editing it would be churn against correct prose. One comment-accuracy file (anno-d64.ts), and six files needing no change rather than five.
- [Phase 27]: shippedTsModules() throws its own named ShippedFilesEntryMissingError instead of taking a caller's assertion library — No call site can opt out of the existence check by forgetting an argument, and all 11 call sites needed no signature change.
- [Phase 27]: codeOnly() was merged as a superset (state machine plus keepLiteralBodies), not a choice between the two divergent copies — The default false path stays byte-identical to the moved original, so the spawn-seam guard's semantics are unchanged, while prg-image's import-specifier caller keeps the literal bodies it must read.
- [Phase 27]: The comment-extractor family stays deliberately split, with all six sites named by filename and line inside shipped-modules.ts — Blanking string bodies would make the literals five of them search for unobservable; anno-tools.test.ts:193-201 states that reasoning in code.
- [Phase 27]: The capability-or-glue record is a typed const with an enumerating guard (module-classification.ts), and its non-vacuity threshold is DERIVED from the registry rather than pinned or written as a growing literal floor — A pinned total goes red on a correct tree the moment a module is legitimately added OR deleted; this project already carries that scar in a guard that pinned per-milestone totals. The threshold "on-disk in-scope count >= in-enumeration entry count" catches a broken or empty glob (proven RED) and self-adjusts in both directions. It explicitly supersedes hostpath-consumers.test.ts ANNO_MODULE_FLOOR = 14, with the reason recorded at the assertion so a later reader does not restore the literal.
- [Phase 27]: OQ-2 resolved: anno-verify.ts is recorded capability per criterion 2, but its basis is written as the DISCIPLINE (acmeVerdict at anno-verify.ts:116) and the tension against EXPORT-01 is stated in the entry note — Criterion 2 is the phase binding text and a registry should not overrule it, but EXPORT-01 states verbatim that the existing verify seam invokes the external analyser and parses ITS transcript, so only the discipline survives. Recording the verdict without the tension would hand a later phase a verdict it will contest instead of a basis it can act on.
- [Phase 27]: OQ-4 resolved: both scripts/lib/anno-cli-verbs files are carried as registry DATA with scope out-of-enumeration, while the enforcing test enumeration stays inside src/mcp/vice/ — CUT-04 names scripts/lib/anno-cli-verbs.mjs explicitly as a guard whose fate must be recorded, so two entries close that blind spot five phases early; keeping the enumeration inside the module directory respects D-09 and avoids a test that reaches into scripts/. Direction 7 proves the marker does the excluding rather than a special case in the loop.
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
- [Phase 28]: The label-kind agreement check partitions LABEL_KINDS BY MEASUREMENT into the three the census compares explicitly and the one it infers, instead of asserting all four appear as literals — Measured this session: anno-coverage.ts never spells "Auto", because computeLabelRatio tests System/Platform then User and infers auto from its else branch. The partition form is strictly stronger -- a re-spelt store member moves out of the spelled set, a census that starts comparing the fallthrough explicitly moves it in, and either direction moves an asserted count.
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
- [Phase 28]: The snapshot ring's identity model names a PATH SPELLING, and no repair of the spelling was adopted: `reconcileSnapshotRing` abstains from the pointer-ROW direction entirely and sweeps only the FILE direction (28-13, CR-05). — An orphan ROW is inert, not fatal — every consumer of "retained" already requires the FILE, so `revertTo` refuses before destroying anything. Rows stay bounded without the sweep because `pruneSnapshots`' doomed loop reaps everything below `currentRevision() - MAX_SNAPSHOT_REVISIONS`. The route has no deletion side at all, and needs no schema bump. The two rejected routes (the review's literal decline condition, and a ring id minted into anno_meta) are recorded verbatim in 28-13-SUMMARY.md so round five does not re-propose them.
- [Phase 28]: `deferred` is WIDENED to mean "this sweep changed nothing" — covering both write-lock contention and a sweep that rolled back — and no second discriminator was added (28-13, CR-07). — Its only consumer, `pruneSnapshots`, returns early identically in both cases, so a discriminator would have no reader; and CR-07's concealment complaint is removed at its source by the structural try/catch rather than labelled. A field describing a state the code can no longer reach is the comment prohibition 28-07 P3 forbids, in the shape of an enum.
- [Phase 28]: Step 8's commit handler ROLLS BACK rather than merely wrapping — the rollback is what releases the store's write lock and undoes the CAS, the mutation and the pointer-row insert together — Wrapping alone would have closed only the family-escape half of CR-06 and left both the leaked write lock and the phantom advanced revision. Proven cross-process: against the pre-plan code the same construction throws a bare Error: database is locked outside the family, with the transaction open.
- [Phase 28]: revertTo's step-6 handler CLOSES the restored connection and REOPENS rather than returning the same handle — If the sweep threw, that connection's transaction state is unknown; handing back a connection that may hold the store's write lock is the defect being closed, not a repair of it. The reopen routes through openStore, which is already inside the ViceError family. After 28-13 the arm is unreachable, so the handler is defence-in-depth pinned by a declared structural backstop.
- [Phase 28]: WR-12 is closed at the cause: `pathEntryExists` wraps every non-ENOENT stat failure, so a regular-file ancestor, an unreadable ancestor and an ANCESTOR symlink cycle refuse with `AnnoStorePathError` at both entry points instead of aborting outside the ViceError family. — `lstatSync(p, { throwIfNoEntry: false })` suppresses ENOENT and nothing else, so 28-12's correct `existsSync` -> `lstat` swap silently regressed three ordinary caller inputs from a named refusal to a bare `Error`. Measured before (inViceFamily=false on all six probe rows) and after (in-family on all six). The wrap also makes `realpathOfNearestExisting`'s existing doc claim true of all four fs call sites, closing the 28-07 P3 comment violation round 3 recorded at anno-types.ts:830-833.
- [Phase 28]: The manual 40-hop symlink bound is structurally UNREACHABLE in ancestor position, and confinement case 15 records that rather than asserting the plan's expected message. — `lstat` does not follow the FINAL path component but must follow every ancestor one, so `<ws>/a` (leaf) reaches the manual hop counter and names 40, while `<ws>/a/sub/p.annostore` (ancestor) makes the kernel's own MAXSYMLINKS throw ELOOP before the walk descends once. Both bounds are 40 by construction -- MAX_SYMLINK_HOPS' own doc comment already said the two disagree about no input -- so the confinement answer is identical either way and only the bound that fires differs. Case 15 pins the ancestor spelling honestly and asserts the leaf spelling's 40 beside it as the comparison.
- [Phase 28]: `retained` is PROMOTED to one meaning -- a revision is retained when its pointer row exists AND its image OPENS as an annotation store -- rather than forked into a second predicate. The advertisement (`retainedRevisions`, `oldestRetainedRevision`) and the destroying gate (`revertTo` step 2, and its `Available revisions:` list) read ONE witness, `snapshotOpenFailure`, whose answer is an actual `openStore`. Rationale: the module's own comment already warned that "three independent decisions is precisely how the three answers came to disagree", and CR-08 was the gap between two of the existing answers -- adding a third would put the destroying call and the advertisement on different sides of the same disagreement again.
- [Phase 28]: The ring's file sweep reads `claimedRevisions` (the pointer-ROW question), NOT the promoted `retainedRevisions`, and the differently named function is the guard against it being mistaken for a fourth answer. Two independent reasons: (1) an image that fails to open but that a row still claims must survive on disk as EVIDENCE rather than be unlinked by a repair -- the promotion would otherwise have made the CR-08 fix its own second destroyer; (2) the keep-set is computed INSIDE the sweep's `begin immediate`, so leaving it on `retainedRevisions` would have opened up to `MAX_SNAPSHOT_REVISIONS` (32) SQLite databases with the store's write lock held on every accepted write. The two answers were identical for every input reachable before the promotion, and diverge only now, in the safe direction.
- [Phase 28]: A JUDGING open is how validity is decided, rather than a second list of checks: `openStore(path, { mustExist: true })` refuses an absent path BY NAME before `new DatabaseSync` is constructed and opens the connection `readOnly`, and everything downstream (the `anno_meta` read, the `schema_version` comparison, `pragma integrity_check`) is REUSED UNCHANGED. Both halves are inseparable -- a judge that can create or modify what it judges would manufacture the empty store it was asked to detect, and read-only is what closes the unlink window between the existence test and the open.
- [Phase 28]: `revertTo` validates the STAGED COPY (step 3b), not only the source image -- the staged file is the exact bytes `renameSync` installs, so judging it is what leaves no interval in which the judged bytes and the installed bytes can differ. Step 2's gate on the source image and step 3b's gate on the staged copy are two POSITIONS of one witness, not two witnesses.
- [Phase 28]: `revertTo` step 2's arms split on the POINTER ROW, not on the image's presence, and the two file-half sub-cases (absent image, present-but-unopenable image) are distinguished by the QUOTED REASON in one message. Asking "is the image absent" separately would put a SECOND predicate back on a snapshot path -- the "two truths about one file" primitive that caused CR-03 and CR-08 both -- and 28-16's own acceptance criteria require zero presence tests on a snapshot path. Recorded as a deviation from the plan's letter in 28-16-SUMMARY.md.
- [Phase 28]: The store-identity admission is an ACCEPTED, OPEN residual and is never claimed closed: an image that opens cleanly, passes `integrity_check` and carries the expected `schema_version` but whose CONTENT belongs to a different store is ADMITTED, because nothing in the schema records store identity. Closing it needs a store-identity column, i.e. a `SCHEMA_VERSION` bump -- this milestone's one-way decision and out of scope for a gap-closure round (threat row T-28-18, `accept`).
- [Phase 28]: `revertTo` step 6's reopens report a revert that LANDED ON DISK rather than a failure (WR-17). Both `openStore` calls after the rename are inside handlers; a `ViceError` is rethrown unchanged and anything else is wrapped naming the store path and the revision. By that line the rename and directory fsync have returned, so presenting it as a failed revert would convert a committed write into a caller-visible failure and send the caller looking for a revert that already happened (prohibition 28-11 P5).
- [Phase 28]: A durability call's GUARD STRENGTH follows which half-state it removes. `stageSnapshot`'s image fsync is UNGUARDED because it removes the destructive outcome -- a durable pointer row naming a file whose bytes never reached disk, exactly the input CR-08 was reproduced with -- and a failure there refuses before `begin immediate`. `publishSnapshot`'s directory fsync is BEST EFFORT because it removes only a missing directory entry, i.e. an orphan ROW: the direction trap 10's premise calls harmless, 28-13 made inert and 28-16 refuses by name. Measured reason: a directory fsync needs `openSync(dir, "r")`, the SAME read bit `readdirSync` needs, so at mode 0300 an unguarded one refuses every ordinary write and destroys the CR-07 control's own precondition. The bound on reachable outcomes is preserved -- the failure moves the outcome between the two non-destructive members of the pair, never out of it. Recorded as a deviation from the plan's letter in 28-17-SUMMARY.md.
- [Phase 28]: A swallowed second error keeps its FACT. All three rollback handlers still swallow a failing `rollback` (there is nothing useful to do with it while unwinding the first error) but now RECORD whether it returned: the two throwing sites branch their message on the recorded boolean and carry `rolledBack` in `data`, and the sweep -- forbidden to throw by 28-11 P5 -- was widened to report `rollbackFailed` in its result instead. Node 22's `DatabaseSync` exposes no transaction-state accessor, which is precisely why the outcome must be recorded rather than asserted; a message that claims a rollback that did not happen reports the CR-06 state as its own repair.
- [Phase 28]: A precondition a test cannot construct is declared in node:test's options object, never asserted true in the body. `assert.ok(true, "SKIPPED as root: ...")` never surfaces its message and never marks the test skipped, so a suite reads green with its only behavioural control silently not executed (WR-14). Both root-sensitive controls now use `{ skip: process.getuid?.() === 0 ? "<reason>" : false }` on one physical line, and the former marker string is absent from the file so a re-introduction is greppable.
- [Phase 28]: The noun `commit` is PROMOTED to its STATEMENT reading, not forked: the single-commit-site control matches an `exec()` call whose single argument is a bare statement literal in any of SQLite's three spellings (`commit`, `end`, `end transaction`), which is what SQLite executes and what the durability planting removes. Evidence the two readings had really diverged: a second, FULLY WORKING commit site spelled `db.exec("end")` passed the old word-count control unchanged (`ok 15`, 17/17). One shared `commitStatements()` helper serves the assertion and both fixture controls, so the coverage the fixtures prove is the coverage the assertion gets (28-18, WR-15).
- [Phase 28]: A STRUCTURAL INVARIANT MAY NOT CONSTRAIN USER-FACING ERROR PROSE. The word-based commit count had already forced the CR-06 refusal to be worded around it and put the explanation in a different file from the constraint. The coupling comment in `anno-store.ts` is deleted TOGETHER WITH the constraint that created it; the `step` VALUE is left unchanged, because changing it would be a gratuitous behaviour change in a round whose whole discipline is not to (28-18, WR-15's mirror cost, prohibition 28-07 P3).
- [Phase 28]: A REQUIREMENT'S STATUS MOVES ONLY ON A VERDICT ALREADY RECORDED IN THE PHASE'S `*-VERIFICATION.md`, and the sentence that moves it quotes its source. STORE-05 returned to `Complete` on the round-4 verifier's own words (`the Gaps Found row is NOT correct on the evidence`); STORE-04 stayed `Gaps Found` with its reason corrected to CR-08 on the same authority. `requirements.mark-complete` was deliberately NOT invoked for this plan's declared `[STORE-04, STORE-05]`, because the verb marks every declared id `Complete` indiscriminately and would have flipped STORE-04 against the verifier (28-18).
- [Phase 28]: THE STORE'S OWN INTERNAL WRITERS ARE VALIDATED BY THE ENTRY POINT'S OWN VALIDATOR. `retype()`'s remainder writes ask `assertRangeShape()` itself, never a re-implemented even-count test, so there is exactly ONE definition of a legal range shape in the repo and a rule added to it later applies to the store's own writer for free. The alternative — a local parity check beside the writer — was rejected because a second copy of a rule drifts the moment the first one is edited, and the drift is silent (28-19, CR-09).
- [Phase 28]: A SPLIT-AND-PRESERVE REMAINDER THAT IS NOT A LEGAL SHAPE FOR ITS OWN TYPE REFUSES THE WHOLE RETYPE — decision (b) of the three the round-5 verification lists as defensible. (a) DEMOTION to the vocabulary's `undefined` member was considered and REJECTED: it destroys the recorded split ORIENTATION, which `anno-types.ts`'s own header calls the one irreversible decision in this area with no field to migrate, so it would be a one-way data decision taken silently on the caller's behalf in the one area named as where such decisions must not be taken. (c) returning the damaged table as data does not satisfy the gap's first `missing` item; its reporting half is honoured anyway. Rounding the caller's range outward to an entry boundary is forbidden outright by trap 7. Rated `costly`, not `one-way`: relaxing the policy later needs only the gate deleted, with no migration (28-19).
- [Phase 28]: COMPUTE, REFUSE, THEN MUTATE. The remainder gate is a SEPARATE loop preceding the mutation loop, over the whole overlapping set, so a refusal costs nothing observable — `listRanges()` deep-equal and `currentRevision()` unchanged, asserted as before/after values. Relying on the transaction's rollback to undo a half-applied mutation was rejected because it would make the guarantee depend on a rollback that 28-17's own `rollbackFailed` work shows can itself fail (28-19, prohibition 28-11 P5 from the other side).
- [Phase 28]: A NEW REFUSAL JOINS THE FAMILY ITS RULE BELONGS TO. `AnnoSplitRemainderError extends AnnoRangeShapeError` rather than `AnnoStoreError`, because it really is a shape refusal — the SAME rule, asked about a range the store is about to write rather than one the caller supplied. Every existing `instanceof AnnoRangeShapeError` caller therefore keeps working when the store starts refusing on this new path, and a caller that wants to distinguish the two asks for the class by name (28-19).
- [Phase 28]: A STRUCTURAL ABSENCE CONTROL IS NARROWED WITH A POSITIVE RULE, NEVER JUST A WIDER ALLOW-LIST. IN-06 makes `never READ a bank value` false in its literal form (four lines now carry one through verbatim), so `anno-store.test.ts`'s control was re-stated as `never INTERPRETED`: the pass-through lines are allowed by exact shape, a non-vacuity floor pins that the scan found the lines it excuses, and an UNCONDITIONAL second assertion forbids any line that branches on, compares or computes with a bank value. Widening the allow-list alone would have left the rule that matters implied by an absence rather than asserted (28-19, deviation recorded in 28-19-SUMMARY.md).
- [Phase 28]: THE INVARIANT'S LIMIT IS WRITTEN BESIDE IT. The round-trip re-acceptance invariant is driven over a DETERMINISTIC FINITE sequence, so it is direct evidence for the geometries that sequence constructs and a BACKSTOP for the unbounded input space; no property-based sweep over all 65,536 start/end pairs is run. Stated in the control's own comment and filed as a structured `backstop` truth, so a later reader cannot read its green as a proof over the whole input space (28-19).
- [Phase 28]: WR-19 closed by matching the commit STATEMENT inside an exec() string literal, anchored at a statement boundary, rather than requiring the literal to BE one. Fixture counts old->new: bare 3->3, semicolon (commit;/end;/COMMIT ;) 0->3, multi-statement 0->1, negative 0->0. — The statement-boundary anchor is what keeps user-facing prose uncounted, so 28-18 P1's decoupling survives the widening. Proven by the negative fixture (identifiers, an exec() taking a bare identifier, two English sentences about a commit) at count 0, whose assertion message names 28-18 P1.
- [Phase 28]: requirements.mark-complete was deliberately NOT invoked for 28-22 even though requirements.ready-ids reported 5/5 ready. — ready-ids only answers whether a sibling plan is still pending; it knows nothing of verification verdicts. Marking all five would have flipped STORE-01 and STORE-03 to Complete against the round-5 verifier's explicit BLOCKED verdict on CR-09, violating prohibition 28-18 P2. STORE-04 was moved by hand with the verifier's authorising sentence quoted; STORE-05 and STORE-07 already read Complete.
- [Phase 28]: CR-10 answered with (b) — an even fragmentation of a split table is ACCEPTED and the re-interpretation is RETURNED AS DATA — not with (a), refuse every partial overlap — Criterion 3's operative failure word is "silently", not "preserve": no proper fragment of a split table preserves a single entry pair at ANY boundary (a fragment of m entries pairs its own byte j with its own byte m + j, matching an original pair only when the fragment IS the whole row), so preservation is not recoverable by a cleverer rule and only the silence can be removed. Answer (a) would make split tables editable only wholesale, and the verifier is explicit that every input here is ordinary annotation work. The disclosure rides beside contradictedComments, the pattern criterion 3 itself blesses.
- [Phase 28]: The disclosure is a RETURN CHANNEL on SetDataTypeResult, not a new on-disk column recording the split table's original extent — A column is a SCHEMA_VERSION bump, which prohibition 28-10 P4 makes a one-way decision requiring the older on-disk shape to refuse by name — and this milestone's single irreversible decision is already spent on the twelve-member vocabulary. The return channel gives the caller the same fact at the only moment it can still act on it and costs nothing that cannot be reverted; setDataType has zero production callers today, so the field is revertible in-tree until Phase 29 publishes it.
- [Phase 28]: The class invariant's caller's-range carve-out is applied SYMMETRICALLY to both sides of the comparison, and the refusals >= 3 floor deliberately does not rise — The carve-out belongs to the COMPARISON, never to the report: a caller range covering 9 or more contiguous bytes of a 16-byte split row wholly contains a pair that is ALSO in that row's entryPairsBefore, so a one-sided carve-out differs by exactly those pairs and reds on a CORRECT write. No step in today's sequence covers more than 8, which is the only reason one-sided would look green — proven by a planting that widens the lost side alone and fires on $1102..$1109. Separately, the round-6 verifier's instruction that the refusal floor rises was written for answer (a); under (b) parity remains the only refusal, so the floor that rises is the new reinterpretingSteps one, and the divergence is recorded in the test's own comment.
- [Phase 29]: The registration-time guard set for the anno_* -> anno_* substitution is SEVEN, not the five plan 29-01 enumerated: module-classification.ts Direction 9 line citations and anno-seam.test.ts files[] exact-three assertion also break on registration. Both are now derived from disk, so a later plan adding an anno-* module needs no edit to either. — Found by running the plan verify command rather than by reading: the plan enumerated guards by identifier grep, and these two break on a CONSEQUENCE of the substitution (a moved line, a grown files[] list) rather than on the identifier itself.
- [Phase 29]: docs/tool-support.md is 8,132 bytes, not the 7,874 that 29-RESEARCH.md and plan 29-01 both asserted. It has been 8,132 since commit 602f9cb (phase 15) and was not touched by plan 29-01. Later plans must not re-derive the 7,874 figure from RESEARCH. — The load-bearing property (the table regenerates byte-identical to the committed file, unchanged by the loop substitution) holds and is now asserted mechanically on BOTH byte length and content in tool-support-table.test.mjs, so the stale figure never has to be trusted again.
- [Phase 29]: WR-02 is closed: assertAnnoTool() sits INSIDE runAnnoTool()'s try, so every anno_* refusal resolves {isError:true} naming the error class rather than rejecting the promise as the anno_* runner does. — anno-tools.ts:772-774 recorded the asymmetry as out of scope for its own plan. One shape for every failure means an MCP caller has one branch to write, not two.
- [Phase 29]: The removal gate scope is (git ls-files minus the .planning/ PREFIX) UNION packFiles("installer") -- tracked AND shipped — git ls-files installer/skills returns 0 while 8 files there mentioning the subject are shipped; npm pack --dry-run runs prepack, so the list is post-sync by construction and cannot forget
- [Phase 29]: Two exemption classes beyond the plan enumeration: surviving-provenance (10 files) and gate-self (5 occurrences) — No plan in phase 29 discharges those 10 files, so allow-listing them would make 29-11 unable to assert the temporary block empty; 18 permanently-exempt files independently reproduces 29-RESEARCH.md figure
- [Phase 29]: Assumption A1 corrected: the full-glob suite does NOT terminate, it blocks forever in vice-proxy.test.ts — Measured 25 min elapsed against 3 s CPU on the one live child; the usable baseline needs a bounded run plus a kill of that child, and its 41 failures are a lower bound
- [Phase 29]: D-15 executed: SCHEMA_VERSION 2 -> 3 with anno_enum_usage and NO migration arm; every version 2 store is deliberately unopenable — Owner-confirmed one-way call, 2026-08-29. Re-measured basis: no store file is tracked in the repo or present in its working tree; anno-store.ts landed 2026-08-27 and the version 2 shape 2026-08-28; the last release tag v0.5.0 (2026-08-25) PREDATES the store, so no tagged release ever shipped it. A migration arm would put new code into a module six hardening rounds went into, to protect stores that may not exist.
- [Phase 29]: An enum usage is associated by anno_enum.id, never by name, and the schema_version refusal is enforced as a SINGLE witness structurally — A name-keyed usage would be silently re-pointed by an updateProjectEnum rename. The single-witness test asserts exactly one comparison site inside openStore, no second anno_meta.schema_version write, and no migration entry point; both plantings were observed RED. Its failure message states that a second comparison site is how a migration arm arrives without a decision.
- [Phase 29]: Search matching is byte-exact and CASE SENSITIVE, matching setLabel's own exact-byte-equality identity rule -- a case-folding search would report a hit on a label the store considers a different name
- [Phase 29]: The never-cache rule is enforced by a two-halved control: six behavioural observations of the store file, plus a directory-wide SQL-write-site census against a named fifteen-entry set of file-and-declaration pairs
- [Phase 29]: Plan 29-05: the rename set is derived entry by entry from module-classification.ts (nine, not eleven) -- the two contested entries are excluded on the authority of their own note fields, never their names — D-03/D-16. Reading only the verdict field is the name-based shortcut D-03 exists to prevent, one level up.
- [Phase 29]: Plan 29-05: a discharged registry entry keys on the NEW filename and its fate records both from and to; the scope means the module no longer answers to the ENUMERATION, not that it no longer exists — Keeps classificationFor() answering for survivors, and makes the deletion arm of the discharge-closure relation symmetric.
- [Phase 29]: Plan 29-05: the removal gate gained a line-scoped atLines exemption shape, because a bucket is a property of a MENTION and the wave-1 gate refused a file present in both blocks — anno-coverage.ts splits 2 permanent + 2 temporary. atLines narrows rather than widens: an occurrence at any other line falls through to the allow-list or to the reintroduction error.
- [Phase 29]: Plan 29-05: docs-uat-abstention.test.ts registered in EXPECTED_DOCS_GUARD_NAMES -- it was the cause of both pre-existing audit-integrity.test.ts failures, and it clears with no DOCS_GUARD_FLOOR change — CR-02 registry drift: the guard landed on disk in 19b5bd5 and was never registered, so the audit gate could not have noticed its deletion.
- [Phase 29]: The anno_* surface is completed in ONE plan (19 verbs), not split — 29-08's derivation check asserts every manifest-curated verb has a route; a same-wave sibling holding part of the surface would make that assertion depend on a sibling and misattribute its failure.
- [Phase 29]: A write verb cannot use openStore's mustExist, so the absent-store refusal moved into anno-tools.ts with an inode-identity guard — mustExist deliberately bundles the absent-path refusal with a read-only connection; the refusal is now made by name before the open, and the unlink-between-check-and-open window mustExist was closing is closed by comparing the store file's inode across the open.
- [Phase 29]: anno_get_blocks carries an include array for scopes, enums and enum_usage instead of the surface growing two more reader verbs — The phase's canonical roll-up fixes the surface at exactly 19 tool names and 29-08's check requires a committed register entry for every unclassified verb; the read routes exist without changing the declared verb count.
- [Phase 29]: anno-store.ts gained removeScope(), addScope's inverse, in the same phase as the refusal it recovers from — F-5 (WR-28 / 28-REVIEW:1788-1814) requires the inverse ship with the refusal; no inverse existed, and anno-tools.ts must never issue SQL of its own, so it had to land in the one write seam.
- [Phase 29]: 29-07: the anno CLI narrows to two verbs, render-memmap and coverage, and the six removed ones are deleted rather than disabled (D-14) — All six were delivery paths into the retired analyser, three directly and three through capability modules; each would have typechecked, dispatched and failed at the first call.
- [Phase 29]: 29-07: the coverage verb names its annotation store explicitly with --store instead of deriving it from the project path — The Phase 28 store holds annotations and never bytes, so a derived measure must be told which bytes it is measuring; deriving one caller-supplied path from another is the silent auto-pick D-02 forbids.
- [Phase 29]: 29-07: the transitional capitalised block-type arm in block-class.ts survives its own removal trigger, and its new trigger is the coverage fixtures being re-spelled — Its producer is gone, but every committed coverage fixture is still spelled in that vocabulary, so removing the arm today would silently reclassify every fixture block as data. Carried as a Phase 32 guard-fate item.
- [Phase 29]: The register requires BOTH a named consumer AND a cited requirement id, stricter than module-classification.ts's one-or-the-other rule — a public surface commitment is not a module that already exists and can be read
- [Phase 29]: Register requirement ids are checked for MEMBERSHIP in .planning/REQUIREMENTS.md, not only FAMILY-NN shape — a plausible-looking id nothing declares is the rubber stamp D-08's prohibition names
- [Phase 29]: anno-register.test.ts's shadowing check uses a deliberately BROADER suffix-equality relation rather than copying anno-derivation.test.ts's exact mapping — a shadowing check must over-approximate, and the exact mapping stays the single place the correspondence is written down
- [Phase 29]: ANNO_MODULE_FLOOR is written as the literal expression 15 plus 1 and never derived from readdirSync, paired with a pinned-equals-measured equality so a same-wave module-set change fails with the right diagnosis
- [Phase 29]: The re-pointing is a PROCEDURE rewrite, not a name substitution: anno_disassemble renders and writes nothing (classification is read-then-record), anno_save_project performs no write, every call names its own store and every derived read its image, and max_results is REQUIRED with no default on five reads
- [Phase 29]: The ABS-02 attribution headers move to a BLOCK-scoped permanent exemption rather than being scrubbed. Plan 29-09's literal criterion of zero subject mentions under installer/skills is unsatisfiable without deleting attributions, which CUT-03 and ROADMAP Phase 31 criterion 1 both forbid (cited as criterion 4 when this decision was taken; `D-01` narrowed Phase 31 to two criteria on 2026-08-30 and this clause became the first of them -- the number moved, the forbidding did not)
- [Phase 29]: packer-finding.mjs's entropySource names the CHANNEL (caller-supplied), never a verb: the number is caller-supplied and the code cannot know its producer, so naming a current verb would claim a run that never happened
- [Phase 29]: check-skill-fork-honesty.mjs's README required-substring is RE-POINTED, not dropped: it asserted a prerequisite claim that died with the integration, and now asserts the CUT-03 attribution that outlives it
- [Phase 29]: D-17: render-memmap reads the annotation store directly -- three store readers on ONE handle opened with an explicit workspaceRoot plus mustExist -- instead of driving an external analyser child through three anno_get_* queries. — The falsified measurement that produced D-17 was a grep blind spot, not an oversight: anno-memmap-render.ts carries a literal NUL at offset 12862, so a plain grep reports "binary file matches" and three separate measurements read it as having zero local imports. Every count this plan took against that file used grep -a.
- [Phase 29]: RenderMemoryMapOptions and CheckRenderedMemoryMapOptions take a REQUIRED workspaceRoot, beyond the planned projectPath -> storePath rename. — T-29-52 asks for openStore() with an explicit root and mustExist, and openStore() refuses outright without a root unless the caller claims the path is module-derived -- which is false for a CLI argument. The mitigation cannot be expressed by the rename alone. The CLI passes the same repoRoot() it confines the path against, so both confinement answers agree by construction rather than by a second rule.
- [Phase 29]: The :79 measurement-provenance comment was kept and re-anchored rather than discharged; 29-05 row 11 stays PERMANENT at 1. — Its subject is live: with the three wire interfaces deleted it is the last record anywhere of what the version-2 digest hashed, which is what makes the "2" -> "3" bump a statement about two KNOWN input shapes rather than one known and one assumed. The plan offered a four-artifact escape (delete the comment, re-pin row 11 temporary/0, update the gate, correct 29-10s acceptance criterion); it was not needed. A co-located test asserts the paragraph still carries the three spellings AND that the declarations it used to point at are gone, so "a comment above a hole" is a red test rather than a later discovery.
- [Phase 29]: The three gated render tests were converted onto the store, not deleted -- plan 29-10s recorded fate for that half is superseded. — D-01 forbids a test driving a real child; it does not ask for the assertions to be thrown away. 29-10s "removes the gated half" was written when that half had no substrate to move to. It does now, so the file went 3 skipped -> 0 skipped with the assertions intact, and one of them gained the malformed-prefix throw its own name had promised since Phase 11.
- [Phase 29]: Phase 29's one-way deletion gate (plan 29-10 Task 1) was ratified by the owner on 2026-08-30 — The deletion was executed on an executor auto-selection, which 29-10-SUMMARY.md recorded as its own weakness. The owner has since answered the gate 'confirmed' (delete-now) against the same five preconditions, each re-verified independently against the summary evidencing it. Recorded as ratification-after-execution, not as a human answer preceding the deletion.
- [Phase 30]: Plan 30-06's new documented-status guard reports a withdrawal claim only when the same markdown paragraph carries no record that the verb came back; a paragraph stating both the 2026-08-29 withdrawal and the 2026-08-31 return is clean by design, because a dated notice must be corrected rather than deleted.
- [Phase 30]: PROJECT.md gained two NEW dated sub-notes (ANNO-13/gen-enums and ANNO-06/export-asm) rather than only editing existing ones: plan 30-06 assumed those withdrawal notes already existed there and they did not, so the record was completed instead of the assumption being carried.
- [Phase 31]: Four judgements, recorded 2026-08-31 so a later reader finds them as decisions rather than reconstructing them from a diff. (1) `STORE-04` is the id plan 31-01 recorded on `anno_undo`'s `omit` disposition, and it is INFERRED, not quoted: no document says "the criterion for `anno_undo` is `STORE-04`" in those words -- `D2`'s closing sentence is that `STORE-04` is scoped to what a planted-violation test can prove, and `STORE-04` is the only requirement whose text contains "an edit can be reverted". The DIRECTION is not inferred: the omission stands, verified three independent ways (`D2`, the Out-of-Scope row, and the live surface carrying no undo route under any spelling across 19 curated verbs), and 31-01 put that reasoning in the justification prose (`STORE-04` / `revertTo` / `D2` all assert present, all three were 0 before) rather than leaning on the id, with the key landing in the siblings' slot -- `anno_undo` now reads `omit STORE-04 disposition,justification,upstream_citation,requirement_id,sites`. Reverses if a later record names a different criterion: a one-token edit the justification prose survives unchanged. (2) Retired requirement ids and superseded phase numbers stay in the manifest as dated past-tense facts; only live routes were re-pointed. 31-01's commit `7adcbaf` is 9 insertions against 8 deletions over one file, and the four retired tokens (`anno-tools`, `anno-session`, `anno-upstream-audit`, `CURATED_ANNO_TOOLS`) went 5 matching lines -> `0 0 0 0` while `SURF-01`, `SURF-03` and Phase 20/21 survived with a date attached. A decision with its reasoning deleted is indistinguishable from an oversight a year later. Reverses per-token: a successor requirement id existing for one of them makes that one a route, and it gets re-pointed. (3) NO permanent gate was built over the manifest's prose, deliberately -- this is the recorded fate of 31-VALIDATION.md's optional Wave 0 item, and the zero-hit sweep stays a plan-time acceptance criterion rather than a committed assertion. Two reasons agree: `anno-derivation.test.ts` is this phase's own verifier for the manifest, so editing it would make the record and its checker move together; and a permanent zero-hit assertion would be WRONG under this phase's governing rule, because a dated past-tense sentence may legitimately name a retired module in a record whose whole purpose is to be a dated snapshot -- which is exactly what judgement 2 just wrote into it. Reverses on recurrence: a second occurrence of this prose drift turns "no mechanical reader" from a tolerated gap into a demonstrated one, and the instrument is then a curated allow-list of dated mentions, never a bare zero. (4) `REPOINT-03` and `REPOINT-04` were NOT promoted by this phase's plans, and the non-promotion is the decision, not an omission: both rows stay Pending with their checkboxes unticked. Criterion 1 measured true on disk before any plan ran -- 31-02 recorded 5 blocks / 5 `Adapted from` lines / 5 `  Source repository:` lines per tree, 10/10/10 across both, and the ABS-03 runner green at 7 skills scanned, 21 pairs compared, observed maximum 0.250 under a 0.35 threshold, allowlist size 0, 7 CLAUDE.md rows all byte-identical -- so the temptation to flip the rows was real. They stay Pending because this project's standing rule is that a status row does not move ahead of the re-verification verdict that scores it, and because the evidence 31-02 produced is a committed assertion whose whole point is that `/gsd-verify-work` can re-run it rather than read a claim about it. Reverses on the Phase 31 verification verdict, at which point the two checkboxes, the two traceability rows and the promotion paragraph move in ONE edit per REQUIREMENTS.md's four-sites-one-edit rule.
- [Phase 33]: GATE-01 decision rules frozen at commit 2a8ef95 (33-01) — the only commit reachable from itself touching the phase evidence directory — Ordering is the entire mechanism: git rev-list --count 2a8ef95 -- evidence/ is 1, so the rules provably predate every measurement in the phase. No test guard (D-06); an ambiguity found later is an ACCEPTED LIMIT in the measuring plan plus an explicit override in the findings document, and the rule text does not move.
- [Phase 33]: GATE-01 cannot abstain: R9 carries no antecedent and the rule set is total over all 108 input tuples — Five inputs with domains 3/3/2/2/3 give 108 tuples, partitioned 54/18/12/8/8/4/2/1/1 across R1..R9 — 84 no-go, 23 degrade, exactly 1 go. The three no-go rules read only corpus-free inputs, and C0_CAPTURE_PAIR: not-obtained is an input value reaching only degrade (D-02/D-03). This removes the defect Phase 23 gate carried and hit.
- [Phase 33]: Task 1 blocking decision gate resolved by the human owner before dispatch with the selection proceed — no value adjusted — An autonomous executor that approves its own pre-commitment has produced no pre-commitment. harden-capture-pair was declined because making C0_CAPTURE_PAIR: fail a no-go would make a captured-and-failed pair fatal while never obtaining a pair stayed only degrade, and D-04 deliberately leaves fail unmapped so its narrowing is authored against the recorded cause.
- [Phase 33]: 33-CONTEXT.md's D-21, D-24 and its compare.mjs code-insight claim carry dated AMENDED 2026-09-02 riders with the measured counter-values (body length >= 65543 / 65555 at minor 1; $0000 <- dir_read and $0001 <- data_read from the 3-byte suffix, not the 4-byte prefix; compare.mjs's four volatile ranges over 4866 addresses and its one-bit-drift-passes rule named incompatible with CAP-02 and with D-25's control), and D-15 carries a fourth rider narrowing its argv byte-identity claim to the fork branch and the profile field against five stock whole-argv assertions — Amend beside the superseded sentence, never over it (T-33-14): a reader who arrives at the decision text alone must not be able to act on the falsified number, and a silent rewrite would erase the fact that it was ever believed. D-21's 4 + 65536 assertion would have refused every real snapshot and fired R1 -> no-go on an arithmetic error.
- [Phase 33]: The test:automated baseline for the remainder of Phase 33 is 2 failing tests in anno-register.test.ts alone (measured EXIT=1, tests 2968, pass 2960, fail 2, broker inactive), down from the recorded phase-open baseline of 5 failing tests in 3 files; the residual cause -- STORE-01, STORE-04, STORE-06 and MCP-04 cited by the anno tool register but no longer declared in REQUIREMENTS.md after the v0.8.0 rewrite -- is recorded as out-of-phase with no Deferred Items row filed for it — Filing a row without a matching file under .planning/todos/pending/ would red the same two-directional AUDIT-04 guard this plan repaired, in the other direction. Naming the residual root cause in STATE.md instead keeps a later reader from mistaking the two anno-register failures for a Phase 33 regression, and keeps the baseline a recorded measurement rather than a moving target.
- [Phase 33]: 33-03: S3 is the anchor-counted sequence for an AUTOSTARTed release — arm the frame anchor while halted, then AUTOSTART, then count CHECKPOINT_INFO hits, with no RESET anywhere. A checkpoint armed before AUTOSTART survives its power cycle (observed CHECKPOINT_LIST total=1). — AUTOSTART is itself a power cycle, so research's separate RESET 1 undid the autostart — that, not the arming order, is why its one attempt produced no usable stop. Settled by one observed reply rather than inferred.
- [Phase 33]: 33-03: AUTOSTART_FRAME_EXACT is not-achieved (differing terms LIN and CYC). Frame-exact and byte-identical through anchor hit 50; lost from hit 75. 33-09 must report the stop identity it achieved rather than assert frame-exactness, and must not adopt -initbreak reset. — The power cycle resets the CPU, VIC-II and CIAs but not the absolute emulated clock, and the 1541's rotational phase is a function of that clock, so the pre-protocol interval leaks into the disk load's byte timing. -initbreak reset would pin the clock but never services a client that connects late.
- [Phase 33]: 33-03: the claim that frame anchoring always fits inside D-22's cap of 64 is withdrawn — the clean sweep reaches 66 differing addresses at jitter 4000, over the cap, while the reported pair reaches 48. The cap stays at 64. — The earlier, D-11-voided pass peaked at 28 and supported the tidier claim. 33-10 must therefore record the jitters it uses for the capture pair and must not retry until the allow-list fits.
- [Phase 33]: 33-03: -warp is behaviour-neutral under a frame-anchored protocol and invalidating for a wall-clock bracket, measured on this host — and AUTOSTART turns warp on by itself for the duration of the load regardless of the argv, with -warp worth only ~1.97x here. — Identical registers and one identical 64K sha256 across warped and unwarped frame-anchored stops, against a 1.76x region overshoot on an identical 10 s wall-clock bracket. 33-06 and 33-11 need both facts before profile.warp and profile.headless ship.
- [Phase 33]: 33-04: the .vsf layout lives in exactly one module (vsf-slice.ts) and the skill reaches it by CLI invocation, NOT by a second copy on anno-d64.ts's two-independent-copies precedent — That precedent duplicates a stable published disk format; the .vsf layout is version-sensitive (a second magic block moved the first module offset; the C64MEM body length differs between two module minors both in the wild) and this project already carried one stale copy of those numbers. A resolution ladder that refuses by name cannot become a wrong image; a second copy silently can.
- [Phase 33]: 33-04: SLICER: was not emitted, and the gap is an ACCEPTED LIMIT rather than a guessed value — SCHEMA.md 2.4 conditions the line on the capture-predicate/capture-seam transcript too, and neither file exists yet; its declared source file is 33-slicer-validation.md, owned by 33-07. validated would have been false and failed would have fired R1 no-go on a sibling plan's absence. No line name invented, no frozen file edited.
- [Phase 33]: 33-05: the stock determinism block is emitted unconditionally, and the four inherited whole-argv assertions moved into Task 1 commit so no commit is red — REPRO-01 block is unconditional on stock, so all five stock whole-argv assertions move the instant buildViceArgs() changes (33-RESEARCH P7). Task 1 own verify demands fail 0, which the plan task split could not satisfy.
- [Phase 33]: 33-05: STOCK_DETERMINISM_SEED and STOCK_DETERMINISM_FLAGS are exported and Object.freeze-d, so the seed has one definition — readonly is erased at runtime; a caller mutating the shared array would produce a launch whose argv no longer matches the seed a capture record cited.
- [Phase 33]: 33-05: the idempotency test observes the -remotemonitor one-time note, not the binmon one — warnedBinmonBindWidened is module state the pre-existing note-once test already consumes, so exactly-one is unobservable on that note from any later test; the text-monitor note is genuinely unconsumed.
- [Phase 33]: 33-05: the re-grounded warp sentence carries no speedup number; the measured ~1.97x lives in the code comment beside the -warp emission — 1.97x is a fact about this host. Publishing it in a generated public capability table would present it as a fact about the tool.
- [Phase 33]: 33-06: the launch profile rides handleAcquire()'s existing per-acquire options bag, not a fifth positional parameter — The real broker wiring already builds a fresh HandleAcquireDeps object per acquire, so per-request data threads through it naturally, and `backend` already sets the precedent of a non-injected configuration value living there. A fifth positional argument after an optional fourth is legal but unreadable at every call site.
- [Phase 33]: 33-06: the launch profile is carried FORWARD across crash-respawn and recycle, which the plan did not name (Rule 2) — launchSupervised() builds a brand new InstanceRecord on every replacement. Without carrying the profile, a recycled or crash-respawned {warp:true} instance comes back UNWARPED while its record no longer matches what the caller asked for -- reintroducing exactly the undetectable mismatch D-16 and T-33-24 exist to exclude, one respawn later. Same defect class CR-01 already caused once in this function (a stock instance respawning with the fork's argv). Threaded via an optional seventh parameter, mirroring CR-02's own remoteMonitorPort carry-forward.
- [Phase 33]: 33-06: buildViceArgs() deliberately does NOT re-validate the profile shape — `profile?.warp` stays a truthiness test, so a boundary-refused string value still switches the fixed literal flag on. Re-deriving the check there would create the second narrowing site this plan exists to avoid, and the VALUE stays structurally unreachable either way -- asserted by a test that plants a string via an unsound cast and requires it to appear in no argv element and as no substring of one.
- [Phase 33]: 33-07: capture-predicate.ts is a REPLACEMENT IN KIND for compare.mjs, keeping its report vocabulary (divergence/pass, the addr/a/b/bits row, hex4/hex2/bin8/popcount, copied not imported) and dropping BOTH its rules -- no address range is a volatile span and there is no bit-count tolerance at any address — compare.mjs excludes four RANGES over 4866 addresses and lets any single-bit difference pass anywhere. A predicate inheriting either rule PASSES D-25's one-bit plant, so the fail-ability control reads green having proven nothing -- a vacuous control is worse than none because it is believed. Also dropped: the $D000-$DFFF exclusion, which is a property of the memory-READ route; the .vsf C64MEM array is mem_ram[] (RAM under I/O), so carrying it over would hide 4096 addresses of real divergence.
- [Phase 33]: 33-07: parseAllowList checks the cap FIRST and throws with no artifact returned, and refuses range-shaped notation BY NAME in both the start/end and two-element-span forms — D-22: exceeding the cap VOIDS the derivation rather than warning -- it means the stop is not frame-exact, which is a fact the gate must hear, so validating the individual entries of a list that cannot be used gains nothing and the count IS the finding. An allow-list is the one input that can turn a failing comparison into a passing one (T-33-26), so every widening route is a refusal: a span-shaped key, a two-element address, a duplicate, an out-of-range address, and the bare-array convenience route which goes through the same cap check.
- [Phase 33]: 33-07: the CAP-03 import census collects module SPECIFIERS rather than matching import STATEMENTS, and its specifier-shape filter is narrow by measurement rather than by taste — Matching quoted specifiers and testing each against a path-anchored stem covers the multi-line static import, the dynamic import(), a bare side-effect import, require() and process.getBuiltinModule() with ONE rule instead of five -- which is why planted violation (a) is deliberately the multi-line shape a per-line matcher cannot see. The filter accepts a node: builtin or a whitespace-free path: an earlier draft accepting every letter-initial literal swept in every refusal message in both modules and made the non-vacuity assertion unwritable.
- [Phase 33]: 33-07: argvDigest's NUL separator is a named constant written as the escape backslash-u0000, never a literal NUL byte in source, after a literal one was written and immediately caught — A literal NUL makes the whole file binary to grep, which skips it silently -- the exact census blind spot D-26 warns about and which anno-memmap-render.ts already caused one false decision through in this project. Detected within a minute (a grep for the constant name returned nothing while tail showed the line). Both new modules and both new test files are now asserted to carry no control characters other than newlines before each commit.
- [Phase 33]: 33-08: the transient allow-list ships as a derivation METHOD, never an address set -- `derive-transients.mjs derive` computes the pairwise union over N >= 3 runs and refuses to re-derive over an existing artifact without `--force` — D-23: an allow-list inherited between releases cannot be distinguished afterwards from an honestly derived one, so a contaminated ledger has no cheap repair. What carries forward is the script; its output is per-release data.
- [Phase 33]: 33-08: over the cap of 64 the derivation VOIDS -- non-zero exit, no artifact written (absence asserted by test), and `--cap` only ever narrows so the flag cannot launder an overflow — D-22: exceeding the cap means the stop is not frame-exact, which is a fact the gate must hear rather than a threshold to raise. Overflow is measured, not hypothetical: 66 addresses at a frame-anchored autostarted stop at jitter 4000 ms.
- [Phase 33]: 33-08: the capture record's `$D000-$DFFF` volatility note is now CONDITIONAL on a new `capture route` Identity row, with both halves retained — The exclusion is a property of the memory-READ route, where `vice_memory_read` samples live I/O. A `.vsf` C64MEM array is RAM under I/O, so on the snapshot route a difference there is real. Copying the note across would hide 4096 addresses of real divergence.
- [Phase 33]: 33-09: the reproducible-run protocol implements the READY-prompt sequence with the hard RESET inside runReproducible(), NOT 33-03's autostart S3 — 33-03 recorded both AUTOSTART_SEQUENCE: S3 and AUTOSTART_FRAME_EXACT: not-achieved. The plan objective's explicit conditional routes not-achieved to the READY-prompt sequence measured green (one identical 64K sha256 and one identical (PC=$ea31, hit_count=1, LIN=257, CYC=57) at jitter 0/1500/4000), which is also what Task 1's acceptance criteria and both verify blocks pin. The module header records S3 as the settled autostarted ordering AND records that it is unresolved for a post-load stop, because frame-exactness holds through anchor hit 50 and is lost from hit 75 (a power cycle resets the CPU/VIC-II/CIAs but not the absolute emulated clock, and the 1541's rotational phase is a function of that clock), with a pointer to evidence/33-autostart-sequencing.md. No autostart path was written and -initbreak reset was not reached for. The procedure therefore REPORTS the stop identity it achieved rather than asserting frame-exactness.
- [Phase 33]: 33-09: the red check-npm-packages.mjs gate was closed by teaching the closure walk that a statement-level `import type` is not a runtime edge, NOT by adding broker-launch.mts to files[] — Phase 3's Rule 2 precedent (6801cf5, 897faf6) is add-the-module-to-files[]. It was tried FIRST and fails on measurement: broker-launch.mts imports its siblings by their COMPILED .mjs specifiers (./broker-state.mjs, ./broker-epoch.mjs, ./backend-detect.mjs), and those paths exist only under resources/, never at the package root, so listing it cascades into three entries no existing file can satisfy. container-guard.mts is listable only because it has no local imports at all. The erased-import distinction is the tree's own documented doctrine, not a new rule: stock-handler.ts's header already permits a type-only import of stock-dispatch.ts because it creates no runtime cycle. Inline `import { type Foo, Bar }` still emits an import under verbatimModuleSyntax and is still walked. Negative control run: removing stock-reproducible-run.ts from files[] still reds with the identical Rule 2 message.
- [Phase 33]: 33-09: hit_count's body offset 13 is carried by one named exported constant plus an end-to-end raw-bytes proof, and is deliberately NOT re-read inside stock-reproducible-run.ts — T-33-32 requires the value be read through stock-protocol.ts's existing parse branch rather than a local offset, and parseResponse() already owns that read at stock-protocol.ts:1370. Duplicating readUInt32LE(13) in the new module to satisfy a plan verify grep would be a second parse of the same field, which is the drift the single-seam rule exists to prevent; satisfying the grep from a comment would manufacture a fake pass. Instead CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET = 13 is the one named definition, and the test builds a RAW 22-byte body whose u32LE at offset 13 is 1 and at offset 12 is 256, pushes it through the real parseResponse(), and asserts the procedure's reported frame term is 1 with an explicit notEqual 256. The 1-vs-256 discrimination is not contrived: offset 12 is the temporary flag, so a non-temporary checkpoint on its first hit gives 00 01 00 00 00. Recorded as a deviation with the substituted check named.
- [Phase 33]: 33-10: C0_CAPTURE_PAIR: pass, and TRANSIENT_COUNT: 49 against D-22's cap of 64 -- the cap's first meeting with a real frame-anchored stop on a real cracked release decided WRITE, so DERIVATION: void is absent and transients/danish.json is committed with 49 ascending entries
- [Phase 33]: 33-10: the pass is recorded with an accepted limit -- the allow-list was derived from three runs two of which ARE the reported pair, so equivalence follows from the union fitting under the cap and ALL discriminating power sits in the cap; CAPTURE_FRAME_EXACT: no is recorded beside it and a planted one-bit flip at $C000 proves the list is not vacuous
- [Phase 33]: 33-10: runReproducible() is NOT usable for an autostarted release -- its hard RESET undoes AUTOSTART and its one-resume wait cannot count 400 anchor hits, so the capture route drives the module's pieces from an evidence script exactly as 33-09's own header prescribes; snapshotPathFor() was likewise declined because it targets a path inside the checkout
- [Phase 33]: 33-10: MEMSPACE_ASSERTION: refuses rests on the @bank:-condition symptom alone -- MEASURED on stock 3.9, a memspace-less ADVANCE_INSTRUCTIONS still steps the MAIN CPU after one drive checkpoint hit, contradicting P10's first symptom; a stepping-only definition would have read did-not-refuse
- [Phase 33]: 33-11 emits the three remaining GATE-01 inputs: SEED_EFFECT pinned, JITTER_IMMUNITY immune, ORACLE_NECESSITY unproven — All three derived by SCHEMA.md's declared rules as code, from six, fifteen and seven live runs on genuine stock VICE 3.9. SEED_EFFECT pinned from 57 of 4080 differing without the determinism block against 0 of 4080 with it. JITTER_IMMUNITY immune from nine runs sharing one sha256 (0999713e, research M4's own digest) and one four-term stop. ORACLE_NECESSITY unproven because the literal antecedent -- two stops EXACTLY one frame apart -- cannot be built on the $EA31 anchor: it is a 60 Hz KERNAL IRQ against a 50.125 Hz PAL frame, MEASURED as 240 anchor hits with 240 distinct (LIN, CYC) and zero consecutive repeats. R6 fires -> degrade, and its pre-mapped narrowing to (PC, hit_count) is exactly what this plan's own variant control supports.
- [Phase 33]: The monitor-issued hard reset does not reset the VIC-II raster counter, so a checkpoint halt before the reset costs frame-exactness — MEASURED as a labelled PREHALT method control in 33-repro02: adding one halt-establishing checkpoint before the reset moved a nine-run immune measurement to not-immune, with the stop raster landing on one of two values 6 cycles apart as a function of the halt phase. A monitor halt reads LIN 0 and the reset then starts from a reproducible phase. This is the mechanism behind 33-10's CAPTURE_FRAME_EXACT: no on an autostarted release, which necessarily has the anchor armed and hit before capture. Method rule for later phases: never add a step before the reset.
- [Phase 33]: probeReady's 1000 ms per-attempt budget is short on every launch profile, and 33-11 records it without changing it — Twenty launches, five per profile: absent 3132 ms max, -warp 3155 ms, -console 2175 ms, both 2385 ms, against a budget of 1000 ms read out of broker-launch.mts's own source. The shortfall is not caused by either new flag -- the argv a stock launch has always emitted is already 2.1 s over, -console reduces it and -warp leaves it unchanged. probeReady has no retry loop by design, so short means the first post-launch pass always misses, never that an instance is lost. The budget lives in host-bound launcher code needing a regenerated artifact, and T-33-38 forbids changing a timing budget inside the plan that measured it; SCHEMA.md 3 puts the line outside GATE-01. Research's single -console observation (unbound at 3000 ms) was NOT reproduced in ten launches.
- [Phase 33]: GATE-01 returns `degrade`, fired by rule `R6` on `ORACLE_NECESSITY: unproven` — derived by walking five values transcribed from column-0 outcome lines through rules committed at `2a8ef95` before any of them existed; `R1`..`R5` did not match and `R7`/`R8`/`R9` were never evaluated. `could-not-run` was structurally unemittable (`R9` has no antecedent; the rule set is total over 108 tuples). Recorded in `docs/phase33-reproducible-run-gate-findings.md`. — The one override available was DECLINED: `33-11` disclosed that `unproven` rests on the strict reading of `SCHEMA.md` 2.3's "exactly one frame apart" and named `33-12` as the only plan that may revisit it. Kept, on four grounds — the frozen text states the strict reading; `proven` is the flattering value and the measuring plan took the unflattering one deliberately; the measurement points the same way `R6` does (the frame term contributed nothing on the variant pair, `hit_count` separated the stops); and the same file's second accepted limit records that the control gives no support to a reading in which the frame term is load-bearing, while `R6`'s narrowing drops that term. Even the generous reading gives an integral, not a one, frame separation.
- [Phase 34]: Phase 34 plan 01 (A-01): host_tool is ONE new ControlRequestKind member carrying a typed tool/args payload, not one member per host tool -- mirrors D-15's precedent, so the two byte-exact ControlRequestKind tests are edited once ever rather than once per future tool. — A generic per-tool op family would widen ControlRequestKind (and its two byte-exact tests) on every new host tool added over the life of the project; one op with server-side per-tool typing in host-tool.mts's own allowlist keeps the wire protocol's own surface fixed.
- [Phase 34]: Phase 34 plan 01 (A-03): host_tool requests carry only workspace-relative paths, resolved and boundary-checked server-side (resolveWorkspacePath); only RESULT paths cross through containerPath(), so the new host-tool module family never joins hostpath.ts's closed five-member consumer set. — Satisfies the path-traversal mitigation (T-34-03), avoids importing hostpath.ts anywhere in the new family, and keeps hostpath-consumers.test.ts's EXPECTED_IMPORTERS unchanged at five -- the ROADMAP's own stated preference, achieved by construction because containerpath.ts is already a declared consumer.
- [Phase 34]: Multi-byte-UTF-8 over-cap test case does not assert hadError===false — Measured: identical byte count over the cap, ASCII content gives a clean hadError=false destroy, multi-byte UTF-8 content gives hadError=true (ECONNRESET) -- a content-sensitive race, not flakiness. The plan's own <behavior> only requires 'IS destroyed' for this case, so the test asserts exactly that plus zero response bytes.
- [Phase 34]: 34-03: resolveGhidraProject() now creates (reserves) the run directory it resolves, not just checks it -- analyzeHeadless requires the directory to pre-exist on the success path, not only the refusal path — Live testing against real Ghidra 12.1.3 found the ghidra.analyze happy path was non-functional without this; fixed in the same session (commit 5694f27).
- [Phase 34]: 34-03: .gitignore's tools/ghidra-runs/ line omits its leading slash — host-scripts.test.ts's deployed-artifact parity scan matches any /tools/-prefixed line and would demand a resourceEntries() counterpart for a runtime-scratch directory that is not a deployed resource.
- [Phase 34-the-host-tool-execution-seam]: acme.mjs and packer-finding.mjs migrated onto the host-tool execution seam via an extracted mcp-module.mjs ladder — SEAM-05 requires the whole-tree grep gate (34-05) to find zero violations; both scripts previously spawned a host binary directly
- [Phase 34]: SEAM-06: a second, independently pinned floor over the host-tool/ghidra/dxa prefix union brings the new family inside the closed-consumer discipline without widening EXPECTED_IMPORTERS — hostpath-consumers.test.ts's ANNO_MODULE_FLOOR is anchored on anno-, so the new family sat outside its scan entirely; a second hand-pinned floor closes the blind spot per 34-RESEARCH.md Pitfall 2
- [Phase 34]: SEAM-07: JVM lifetime binding recorded as per-invocation, matching what plans 34-01/34-03 actually built, with a checkable reversal condition (N=20 binaries, P=30 percent of wall-clock in JVM startup) to resident-socket — docs/phase34-host-tool-seam-decisions.md consolidates the measurement (12407ms/11160ms observed, 12.6-17.4s cited range) and all fourteen planner assumptions A-01..A-14 since no /gsd-discuss-phase ran for Phase 34
- [Phase 34-the-host-tool-execution-seam]: SEAM-05's BANNED_COMMAND_SHAPES includes both unp64 and UNP64 for the packer oracle's two documented names, plus dxa, analyzeHeadless, c1541, petcat, cartconv and x64sc — No second literal command name (distinct from the env-var name) exists anywhere in this codebase for the packer oracle; unp64/UNP64 is the most defensible reading of the plan's phrasing
- [Phase 34]: 34-07 closed CR-02/CR-03: acme.build's includes and ghidra.analyze's preScript/postScript now resolve through resolveWorkspacePath() before reaching argv, read by buildHostToolArgv() only from a resolved-paths parameter, never request.args. — Two of the three confirmed argv-passthrough violations from 34-REVIEW.md. SEAM-02 stays Pending -- shared with 34-08 (oracle.probe's command, CR-01), and the shared-ID gate correctly withheld it (0/1 ready).
- [Phase 34]: 34-08 closed CR-01: removed oracle.probe's caller-supplied `command` wire key entirely and added resolveOracleCommand(), the ONE host-side resolver consulted by both runOracleProbe() and runOracleRun(), reading the broker process's own UNP64/UNP64_PATH environment and checked by base name and existence.
- [Phase 34]: 34-08 added HOST_TOOL_PATH_ARG_KEYS: a declared census of every path-bearing host-tool argument key (7 total across 4 tools), with a both-directions completeness case and a data-driven escaping/absolute refusal loop, so a future path-bearing key cannot ship unresolved without a red test.
- [Phase 34-the-host-tool-execution-seam]: 34-09 (CR-04) closed the phase's headline DoS defect: ghidra.analyze's server-side budget is now 600_000ms (10 min, cleared against this project's own 12.6-17.4s documented JVM-startup range and its 12407ms/11160ms observations) with an 11-minute client-side deadline, and hostToolOverControlPlane()'s single connect-bound timer is split into a connect phase and a separately-sized request-deadline phase mirroring openBrokerControl(). SEAM-02 flipped to Complete only after the three-plan (34-07/34-08/34-09) closure gate ran and passed. — Every tool now has an explicit, finite server-side budget and a strictly-larger client-side deadline, asserted by a test that imports both sides and iterates every tool id -- the anti-drift mechanism for two numbers deliberately living in two processes. No wire-supplied timeout was introduced; budgets stay host-side configuration.
- [Phase 34]: resolveWorkspacePath() now walks both the workspace root and the candidate through an ancestor-realpath walk (mirroring anno-types.ts's storePathWithinWorkspace()) and returns the real path, closing CR-05; the walk is duplicated locally in host-tool.mts (A-15) rather than imported, because host-tool.mts is host-bound and cannot reach a container-side .ts module, and pinned to its container-side twin by a cross-implementation equivalence test. — The returned path being real rather than lexical is load-bearing since it is exactly what reaches the spawn; the container-translation consequence on a symlinked workspace root is recorded as a limit (A-16) rather than widening hostpath.ts's closed consumer set.
- [Phase 34]: 34-11 ran the full verification gate BEFORE editing any bookkeeping (module-family suites 158/158, ledger+confinement guards 55/55, typecheck/npm-packages/spawn-gate clean, test:automated 3270/3278 pass with the measured 2-in-1-file anno-register.test.ts floor, no regression), then in one commit moved the CR-05 todo to .planning/todos/completed/ with a Resolution and removed its Deferred Items row (9 -> 8 open), and appended docs/phase34-host-tool-seam-decisions.md's Part 4 CR-05 correction plus A-15/A-16. — WR-03's row and todo were deliberately left untouched (still Pending); SEAM-02's Complete marking in REQUIREMENTS.md was not re-scored, per the verifier's own written ruling.
- [Phase 35]: Corrected the dxa.disassemble census total (7->12, not the plan's stated 7->11) and the vendored-binary path resolution (a two-candidate probe, since resources/host-tool.mjs and vendor/dxa/dxa are siblings, not nested) -- both required for the plan's own acceptance criteria to pass. — Verified against source: DXA-01's declared path-key enumeration (5 keys) plus the pre-existing 7 sums to 12.
- [Phase 35]: 35-02: exported a new DumpRange type (beyond the plan's own enumerated artifact list) because both tasks' action text and acceptance criteria require a named, typed rendered range list
- [Phase 35]: 35-02: overlapping-decode resolution uses a claims-collect-then-resolve pass so an address with more than one claim always becomes unclassified, agreeing or not, with no tie-break rule anywhere in the module
- [Phase 35]: dxa-partition.ts's BASIC-stub link check validates against the terminator scan's actual next-line address, not merely forward-and-in-bounds, catching an off-by-one link as non-line-start — stricter than the plan's minimum text; prevents a corrupted stub from silently succeeding with a wrong certain-data span
- [Phase 35]: Both ground-truth tiers print a self-referential composition rate (data as a fraction of what the tier itself can prove) rather than any comparison to dxa's own output — neither tier module imports dxa-listing.ts (T-35-13); a data-recovery-rate against dxa belongs to Phase 38
- [Phase 35]: dxa-blocks.ts defines its own KnownDataRow type rather than importing anno-types.ts's RangeRow; DxaRunArgs.knownDataRows is mutually exclusive with datablocksPath/labelsPath — RangeRow carries no sym field; a caller merges range and label info before calling. Mutual exclusion mirrors host-tool.mts's own first-refusal-wins discipline.
- [Phase 35]: Phase 35 closed: DXA-02's real-refusal evidence comes from feeding a real, unmodified dxa listing to the project's pre-existing Phase 23 evidence parser, not the current dxa-listing.ts (deliberately redesigned by A-04 to NOT refuse on this exact artefact); both parsers' behavior on the same real artefact is recorded side by side. — The plan's own text states this is exactly what DXA-02 criterion 2 asks for; both parsers are this project's own code, never dxa's exit status, and recording both prevents conflating the historical defect with the current module's correct non-reproduction of it.
- [Phase 36]: Applied the eight sized-local SLEIGH fixes to docs/undocumented-opcodes-ghidra.md's fenced source verbatim per 36-RESEARCH.md's verified fix; MEASURED to compile clean, exit 0, only the two expected warnings plus one pre-existing stock-inherited warning.
- [Phase 36]: installedLanguageIds() was deliberately NOT implemented in plan 36-01 -- 36-02-PLAN.md's own action text specifies it as that plan's deliverable with a different, from-scratch spec.
- [Phase 36]: classifyGhidraRunLog()'s classification-count question is provisional (generic labelled-number extraction) since the export script that will print those numbers does not exist until plan 36-03; that plan's own instructions anticipate recording a finding rather than editing ghidra-run.ts.
- [Phase 36]: loaderBaseAddr is REQUIRED inside buildAnalyzeHeadlessArgv(), mirroring processor's own required/re-validated treatment; host-tool.mts always supplies a value (caller's own, or the route's own default).
- [Phase 36]: expectedClassificationLines without exportPath is refused too, beyond the plan's literal wording -- without exportPath it would silently occupy the export script's argument-0 position instead of argument-1.
- [Phase 36]: 36-03: GhidraStructExport.java's classification expectation is computed from mem.getBlocks() internally; script argument 1 only OVERRIDES that assertion, never replaces its normal source. — Lets the hermetic gate plant a deliberately wrong expectation and observe a real throw, while the normal path never trusts a caller-supplied number.
- [Phase 36]: GHID-01's three gates (thrown-script exact literal with uninformative exit status; block-total classification count on both import routes; reproducibility plus a version-declared Ghidra prerequisite) were each observed firing on a real analyzeHeadless run against Ghidra 12.1.3 — Live proof was required before any later plan reads these gates as trustworthy instruments; recorded in evidence/36-04-three-gates.md
- [Phase 36]: GhidraStructExport.java's ## REFERENCES section never reflects the volatile flag (MEASURED, byte-identical with/without); added an additive ## DECOMPILED_TEXT section as the actual site of the effect
- [Phase 36]: fixtures/ghidra/README.md corrected: the .prg route's real entry point is $0812 not $0810 -- BinaryLoader does not strip the .prg header, shifting addresses two bytes later
- [Phase 36]: 36-06: a documented RTS terminator is required in every synthetic opcode-sweep slot -- without one DecompInterface fails every seeded function outright — MEASURED live against real Ghidra 12.1.3: NOP-only padding lets fall-through disassembly run each seeded function off the end of the image with no discovered exit
- [Phase 36]: 36-07: COMPUTED_JUMP asserted absent (BRK-trick finding) on real corpus; DataTypeManager control invoked directly outside the seam — GHID-05's flagged assumption anticipated uncertainty; measured absence disclosed as a positive checked fact rather than forced or loosened
- [Phase 37]: Two new anno_* tools (anno_import_ghidra_export, anno_join_memmap) added to the existing ANNO_TOOL_DEFINITIONS array -- no new tool family, no new CLI verb, no new store column (D-37-01). — stock-dispatch.test.ts's BACKEND_SEAM_BYPASS_KEYS is a pinned 2-entry order-sensitive array; a second tool family would collide with it. Array length does not create a registration key.
- [Phase 37]: 37-02: CONST_WRITES CALLOTHER dispatch on Ghidra's documented BUILTIN_VOLATILE_WRITE constant (userop.cc), not a language-registered name
- [Phase 37]: 37-02: fixed two live-only importer bugs (CLASSIFICATION miscount, bare-hex address refusal) found by running against a real Ghidra capture for the first time
- [Phase 37]: Plan 37-03: selectMemmapEntry() implements the complete three-deep selection order (width, sym tie-break, stated residual entries-order rule), with tieBrokenBy reporting which step decided; runMemmapJoin()'s in-image skip is proven unreachable via an injectable counting-spy seam; every derived comment now carries the full memmapSha256 provenance token, computed once per run.
- [Phase 37]: The "processor-port address" plan 37-04's Task 3 names is $0000 (the data-direction register), not $0001; verified against 37-03-SUMMARY's own re-measured fixture (3 contenders, index 1 carries sym D6510). — 37-03-SUMMARY.md states this verbatim; $0001 (the processor port register proper) is a different, unrelated three-entry set with a different symbol (R6510) and would have produced a wrong control.
- [Phase 37]: Plan 37-05: in-image control subject is $0800 (BASIC area, real map entry Unused), not a hardware register, since AUTO-03's failure story is about ordinary program addresses — Hardware addresses like $D020/$0000 would prove nothing about the specific requirement failure mode
- [Phase 37]: Plan 37-05: re-export shims (forward by absolute path) satisfy anno-join.ts's sibling imports in a scratch tree, instead of mirroring anno-store.ts's own deep dependency chain — Only anno-join.ts needed mutating; its siblings only needed to resolve, and the shim reuses the same cached real module the test file imports statically
- [Phase 37]: Plan 37-06: the bank-state candidate constraint narrows selectMemmapEntry()'s own entries array before selection runs, rather than adding a new parameter to that function -- memmap-lookup.ts stays untouched. — Keeps the constraint genuinely 'before the address, not a post-filter' while satisfying the plan's own instruction without touching a sibling module.
- [Phase 37]: Plan 37-06: runMemmapJoin()'s new constWrites argument activates the bank-state machinery only when explicitly supplied (even an empty array) -- undefined (every pre-37-06 call site) is a complete no-op. — Guarantees the candidate-constraint argument never changes any unconstrained selection's answer, by construction.
- [Phase 37]: 37-07: Graphics-range derivation (AUTO-06) uses a cross product of each VIC register's own distinct recovered values, not a reaching-value graph walk, since it is forbidden from reading the cross-reference graph at all
- [Phase 37]: 37-07: The committed capture (export-bank-path-dependent.txt) carries zero writes to DD00/D018/D011 -- every graphics register test case is a hand-built fact list; plan 37-08's fixture is the future real-capture case
- [Phase 37]: AUTO-07: dataRangesPath is the ONE new wire field; DataRangeSeed.java's own -preScript pair is always emitted first in argv, before any caller-supplied preScript. — VolatileCarve.java's own analyzeAll() call must never run before the data ranges are marked as data.
- [Phase 37]: AUTO-07's phantom-label proof is flat-64K-route only; the .prg route's own two-byte load shift misaligns the register-derived range against where the fixture's charset bytes actually land there. — Measured live against real Ghidra 12.1.3.
- [Phase 38]: Phase 38 plan 38-01: PROOF01_FALSE_POSITIVES is unconditionally the structurally-uncomputable refusal string, never a bare integer, because certainCode is always empty on the byte-derived tier (D-03).
- [Phase 38]: Phase 38 plan 38-01: TEST_AUTOMATED_BASELINE measured at tests 3519 / pass 3506 / fail 2 (broker confirmed inactive), differing from 38-VALIDATION.md's stated pass 3517 figure -- recorded as observed per this phase's own never-re-derived convention, not reconciled.
- [Phase 38]: PROOF-03 measured in both directions against the real bank-path-dependent fixture: the $D020 write annotates differently under $34 vs $33 (differ), and a scratch-mutated forward-carry annotates confidently and wrongly exactly where the committed code declines.
- [Phase 38]: 38-03: Ghidra scratch workspace must avoid dot-prefixed path segments (resolveGhidraProject refuses .cache); use a sibling non-dot scratch root for Ghidra runs specifically.
- [Phase 38]: 38-03: PROOF02_LOADER_COMPUTED_DISPATCH recorded not-exercised -- zero computed-index sites enumerated at the loader/depacker depth, not a claim about the whole release.
- [Phase 38]: [Phase 38 P04] PROOF02_COMPUTED_DISPATCH: not-exercised (roll-up across both loader and depacked depths) -- zero computed-index sites enumerated at either depth; not a claim that no computed dispatch construct exists anywhere in the release. The reported depacked capture pair (jitter 0 both sides) was byte-identical and frame-term-exact, a stricter result than Phase 33's own reported pair, and no entry points were supplied to the flat64k-route Ghidra run since the capture was taken mid-load.

### Pending Todos

10 pending (10 files in `.planning/todos/pending/` + 0 UAT-gap rows = 10) — see
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
mislabelled `cpuhistory-get*` fixtures, and the ACME/analyser gate
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
literals in `anno-cli.ts`/`anno-project.ts` and `docs-dangling-refs.test.ts`'s
own `VSF_BACKLOG_ITEM` constant from `pending/` to `completed/`, since the
anno CLI's own refusal message names this exact path), and the
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

**A todo was filed 2026-09-07**, outside phase work, via `/gsd-capture`:
`2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools`. Every
disk-writing tool in the plugin picks its own top-level location under the
resolved project root — `.vice-supervisor/`, `.vice-snapshots/`, `tools/`,
`tools/ghidra-runs/`, `.planning/incidents/`, `mcp-deps.lock.sha256` — so a
consumer using more than one tool collects five or six unrelated root entries,
each with its own `.gitignore` stanza. The todo proposes a single
`.c64-re-tools/` root with typed subdirectories, as a **clean break with no
back-compat**: severity confirmed `minor` by the operator at capture time with
the explicit constraint "no support/fallback for the old structure", so no
dual-read, no migration shim, no opt-back-in env var. Not scoped into any
v0.9.0 phase. This paragraph's own count line above read 8 against a 7-file
tree before this filing (stale by one in the opposite direction from the
usual); with this todo the tree is genuinely 8 and both figures agree again.

**A second todo was filed the same day (2026-09-07)**, also via `/gsd-capture`:
`2026-09-07-move-all-tests-into-a-separate-test-folder`. Tests in this repo are
colocated next to the module under test — 154 of them in `src/mcp/vice/` alone,
interleaved with roughly as many source modules, plus nine more under
`installer/` and `src/skills/*/scripts/`. The todo captures moving them into a
dedicated test directory. Filed rather than done inline because the move is not
mechanical: 482 sibling-relative import lines change depth (and the project
deliberately has no `tsconfig` `paths` remapping, with every import carrying its
real extension for Node type-stripping), and at least five path consumers key on
the current layout — `package.json`'s cwd-only `node --test '*.test.*'` glob,
`test-gate.mjs`'s bare-basename `MANUAL_ONLY_TESTS`, `ci-suite-coverage.test.ts`'s
tree walk and `SKILLS_GLOB_PROOF`, `scripts/check-npm-packages.mjs`'s tarball leak
assertions with `package.json`'s hand-maintained `files[]`, and `CLAUDE.md`'s
Conventions section, which documents colocation as the standing rule. Get the
glob wrong and the suite reports zero failures while running zero tests, so the
todo names a before/after test-count comparison as the verification gate rather
than a green run. Severity `minor`, confirmed at capture. Not scoped into any
v0.9.0 phase. The tree is 9 files with this filing; the count line above and the
ledger table row below were both updated in the same change.

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
| 260821-a86 | Close Phase 11's three open SECURITY.md findings: WR-01's parent-realpath containment in `resolveStorePath()` (deepest-existing-ancestor walk + dangling-symlink-component refusal), T-11-NAME-INJECT's REJECT policy on both label-name entry routes (`anno_set_label_name` outer *and* batch-inner, `importLabels()` naming the offending `.lbl` line) via a new dependency-free `anno-acme-ident.ts` seam, and WR-04's Markdown-cell escaping in `renderMemoryMap()`; `11-SECURITY.md` flipped to `threats_open: 0` / `status: verified` | 2026-08-21 | de788b9, bb08c46, 2c287cb | passed (orchestrator re-ran the gates independently: `tsc --noEmit` clean, `test:automated` 1947 tests / 1942 pass / 0 fail / 5 pre-existing todo, `check-npm-packages.mjs` green, all three controls confirmed present in source) | [260821-a86-fix-phase-11-security-md-open-findings-w](./quick/260821-a86-fix-phase-11-security-md-open-findings-w/) |
| 260821-jd8 | Close 10-REVIEW.md's WR-08, Phase 10's last open security finding: `parseArgs()`'s `--entry`/`--out` refused a missing or flag-shaped value (`bootstrap x.prg --out --entry FOO` wrote a project literally named `--entry`); reused `parseExportLblArgs()`'s existing guard shape across all three verbs that route through `parseArgs()` (`bootstrap`, `export-asm`, `verify`); pinned by 10 new tests proven non-vacuous against a scratch pre-fix revert; assigned T-10-19, `10-SECURITY.md` flipped to `threats_open: 0` / `status: verified`; pending todo moved to `completed/` with a Resolution section | 2026-08-21 | 3541886, e0fd305 | — | [260821-jd8-close-wr-08-flag-shaped-option-values](./quick/260821-jd8-close-wr-08-flag-shaped-option-values/) |
| 260823-kf6 | Correct STATE.md's carried-forward ledger: QUAL-01/02/03 closed by PKG-02/03/04, plus DEBT-04's closure note | 2026-08-23 | 793d8bc, 8205ef9, 0bc005c, a2ea0a0 | passed (orchestrator re-read all three corrected sites — STATE.md's table, STATE.md's Deferred Items prose, REQUIREMENTS.md's DEBT-04 note — and confirmed they agree on one surviving open row (`UP-01`/`UP-02`); the derived `0 items` count, the `UP-01`/`UP-02` row and REQUIREMENTS.md's open `### Control-Plane Bind Follow-on` all preserved; `PKG-04` recorded as accepted risk, not narrowed. The one `npm test` failure (`audit-integrity.test.ts` T-12-04, a hard-coded `tech_debt` count of 3 against 4 audit files) independently confirmed pre-existing — introduced by `76f7b15`, the pre-task HEAD, and this task touched no audit file) | [260823-kf6-correct-state-md-s-carried-forward-ledge](./quick/260823-kf6-correct-state-md-s-carried-forward-ledge/) |
| 260901-n24 | Bump the Node engine floor to >=24.0.0 (vice-mcp engines, CI node-version, all stated requirements) | 2026-09-01 | 42f83bc | — | — |
| 260901-qzp | Erase the retired external analyser's name from the whole tree — ~20,200 occurrences across 612 files; retires the removal gate, the attribution chain and the fate-audit subsystem, preserving their non-subject coverage | 2026-09-01 | 09150c8 |  | [260901-qzp-purge-external-analyser-name-from-tree](./quick/260901-qzp-purge-external-analyser-name-from-tree/) |
| 260902-ech | Strip the 6 unverified chat-artifact citations from `docs/undocumented-opcodes-ghidra.md` (5 carried `utm_source=chatgpt.com`; `[4]` pointed at a third-party VICE fork mirror) — 7 inline markers and 6 link definitions removed, 776 -> 766 lines, the author's own "not yet compiled" caveat preserved | 2026-09-02 | 6749c66 |  | [260902-ech-strip-unverifiable-chatgpt-artifact-cita](./quick/260902-ech-strip-unverifiable-chatgpt-artifact-cita/) |
| 260902-tkg | Anchor `scripts/package.sh`'s leak guard — `tools/` to the archive root, `node_modules/` at any depth — unblocking the release build, RED on every push since 2026-08-29 on a false positive against nine phase-23 `evidence/tools/` files | 2026-09-02 | 5071e24 |  | [260902-tkg-anchor-tools-leak-guard-to-archive-root](./quick/260902-tkg-anchor-tools-leak-guard-to-archive-root/) |

### Blockers/Concerns

- **Phase 37 carried items (2026-09-05), none blocking Phase 38.** The phase closed at
  5/5 must-haves on the first verification round (8/8 plans across 4 waves). Two residuals
  ride forward, both disclosed rather than silently inherited. (1) **The const-write facts
  survive only across ONE call pair** — a caller that runs `anno_join_memmap` without
  re-passing the `const_writes` array `anno_import_ghidra_export` returned silently gets the
  unconstrained behaviour, which is the same shape of gap code review `CR-01` caught. It is
  now visible in the tool schema rather than hidden in a no-op, and the decision (not to
  widen `STORE-05`'s reserved `bank` column inside a review fix) is logged in PROJECT.md.
  (2) **`c64-program-recon/SKILL.md` does not describe the `const_writes` round-trip** —
  the verifier recorded this as a non-blocking documentation gap, since the tool's own
  `inputSchema` descriptions do document it, so a caller is not misled.

- **Two test-suite facts, both characterised rather than chased (2026-09-05).** The
  documented floor is 2 failing tests in `anno-register.test.ts` (`STORE-01`/`STORE-06`
  requirement-id bookkeeping, out of every recent phase's scope). Separately, an
  intermittent INTER-FILE race was observed three times across this phase's gates:
  `audit-root-args.test.ts`'s `check-skill-tool-coverage` / `check-skill-fork-honesty`
  cases fail with `ENOENT` on a `zz-scratch-*.md` file another test file created and
  removed mid-run. `node --test audit-root-args.test.ts` in isolation is 58/58 every
  time. Treat a 3- or 4-fail run as this race until proven otherwise; the floor is 2.

- **Phase 34 carried items (2026-09-04), none blocking Phase 35.** The phase closed at
  7/7 must-haves on its third verification round (11/11 plans across 9 waves; two
  gap-closure rounds). Three residuals ride forward, all recorded rather than silently
  inherited. (1) **`WR-03` stays OPEN** — `runOracleRun()`'s scratch-directory creation sits
  outside its `try`, and the CLI entry point has no `.catch()`, so an environmental failure
  becomes an unhandled rejection instead of the module's own `{ ok: false, message }`
  contract. Tracked in
  `.planning/todos/pending/2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes.md`
  and named in `docs/phase34-host-tool-seam-decisions.md` Part 4 as deliberately not folded
  into the `34-10`/`34-11` round. (2) **`WR-01` and `WR-02` are deferred by explicit
  decision**, both re-confirmed unchanged in the round-3 review: the spawn-gate detector is
  evadable by aliasing the spawn function (`cp["spawn"](...)` or an unresolved destructuring
  rename), and `host_tool` has no admission control, so several concurrent JVM-spawning
  requests can pile up unbounded inside `CR-04`'s ten-minute `ghidra.analyze` budget.
  (3) **`CR-05`'s fix leaves two stated limits, not handled cases** — the check-then-open
  window between the confinement decision and the child process's own open (the child is a
  third-party binary handed a path string, with no descriptor-based route available), and
  path equality being byte-wise with no Unicode normalisation, so a filesystem that
  normalises on its own may accept a path this check computed differently. Both are recorded
  as assumptions `A-15`/`A-16` and Part 4 residuals in the decision record.

- **Phase 32 carried items (2026-09-01), none blocking the milestone close.** The phase
  closed at 17/17 must-haves with `behavior_unverified: 0` after three gap-closure rounds
  (21/21 plans), UAT test 1 passed, `32-SECURITY.md` `threats_open: 0`, and
  `32-VALIDATION.md` `nyquist_compliant: true`. Four residuals ride forward, all recorded
  rather than silently inherited. (1) **Nine round-4 review findings stay OPEN**, carried to
  the milestone backlog by an explicit operator decision at the UAT gate (option (a)):
  `CR-07`, `WR-37`..`WR-40`, `IN-16`..`IN-19`, tracked in
  `.planning/todos/pending/2026-09-01-phase-32-review-round-4-nine-open-findings.md`
  (severity: blocker), with the disposition and its reasoning also recorded in
  `32-VERIFICATION.md` § Acknowledged Gaps. **`CR-07` is a Critical that has been open
  across three review rounds and was absent from the round-3 report for one full round
  without ever being fixed** — read that record before re-reviewing it, because the gap in
  the record is the part worth inheriting knowingly. It is a latent scheduling hazard
  (`audit-root-args.test.ts` rebuilds the gitignored `installer/skills/` tree five times per
  run while four other test files read it under a parallel runner), not an observed failure;
  the suite was green twice on 2026-09-01. (2) **Three accepted-open security risks**, all
  medium and below the `high` block threshold: `AR-32-01` (lexical containment vs. an in-repo
  outward symlink, `WR-04`), `AR-32-02` (`evidenceMarkdown()` fence injection, `WR-12`),
  `AR-32-03` (`redOwed()` looseness, `WR-06` — basis re-measured 35/35 honest today, but
  measured rather than enforced). (3) **`WR-38` is a self-applied criterion-1 defect**: the
  assertion labelled "the one that must never change" at `audit-harness-restore.test.ts:1209`
  still passes with containment removed. The case as a unit still bites — the following
  assertion at `:1217` does discriminate — so the mitigation is intact and only the label is
  wrong. Rank it first in any round 5. (4) **The earlier 25-finding ledger stays OPEN** in
  `.planning/todos/pending/2026-08-31-phase-32-review-twenty-five-open-findings.md`, minus
  the 8 closed by plans 32-20/32-21.

  Not a residual, but recorded because it has now cost time three times:
  `repo-root.test.ts`'s `the agreed path is not under .claude` case **fails inside a worktree
  executor** and passes on the main checkout. Phase 32's own `deferred-items.md` logs it
  again (1 failure out of 2941). Environment-induced; re-measure after merge.

  Also measured at this close and left alone deliberately: STATE.md's Performance Metrics
  **"Total plans completed" reads 273 while 280 `*-SUMMARY.md` files exist on disk** — a
  pre-existing 7-plan drift (252 vs 259 before this transition), not introduced by it. The
  milestone-scoped counters are correct (`total_plans: 80`, `completed_plans: 80`,
  `percent: 100`). Not "fixed" here because the all-time counter's inclusion rule is
  undocumented — phases 06, 20-22 and 24-26 have no summaries on disk — and redefining a
  project metric from the orchestrator seat to make a number agree is the same move this
  project's guards exist against.

- **Phase 31 carried items (2026-08-31), none blocking Phase 32.** The phase closed at
  13/13 on re-verification round 2 after one gap-closure round (31-04), and three
  residuals ride forward, all recorded rather than silently inherited. (1) **Five review
  findings stay deferred**: `31-REVIEW-FIX.md` carries `status: partial_fix` — 6 of 11
  fixed (`CR-01`, `CR-02`, `WR-01`, `WR-03`, `WR-05`, `WR-06`), 5 deferred (`WR-02`,
  `WR-04`, `IN-01`, `IN-02`, `IN-03`) each with a named trigger rather than a bare
  postponement. (2) **`31-04-SUMMARY.md`'s coverage entry `D1` miscites its own
  evidence**: it names `ci-suite-coverage.test.ts` as the integration verification for
  "ordered before the `Test` step", but that suite asserts only that every committed
  suite is executed by CI — it does not parse or assert step order. `31-VERIFICATION.md`
  records this as a Warning-level anti-pattern; no false pass rides on it, because an
  absent or reordered step now hard-fails through `emptyRootVerdict()`'s CI branch.
  (3) **No committed assertion pins the `ci.yml` step order itself.** Accepted for the
  same reason: the CI branch turns a missing sync step into a loud red rather than a
  silent half-scored pass, and the verifier executed that rather than inferring it.

  Not a residual, but recorded because it cost time twice: `repo-root.test.ts`'s
  `the agreed path is not under .claude` case **fails inside a worktree executor** and
  passes on the main checkout — `repoRoot()` resolves to the worktree root, which is
  itself under `.claude/worktrees/`. Treat that single failure in an executor's
  self-check as environment-induced and re-measure after merge, not as a regression.

- **Phase 28 carried items (2026-08-29), none blocking Phase 29.** The phase closed
  at 12/12 with `gaps_remaining: []`, but three residuals ride forward. (1) The
  **single-writer property is unenforced**: `retype()` is the only writer of
  `anno_range` today (three `insertRange` call sites, all inside it; one
  `delete from anno_range`), and the class-level completeness of criterion 3 rests
  on that — but nothing declares or enforces it, so a fourth `insertRange` added
  outside `retype()` would bypass the shape gate silently and 218 green tests would
  not notice. Recorded as accepted risk `AR-RES-01` in `28-SECURITY.md`; the fix is
  to pin the call sites structurally in `anno-seam.test.ts`, which already owns that
  pattern. (2) **WR-31's two comments** (`anno-store.ts:2131-2139` and `:1918-1922`)
  assert a protection the code does not provide — scoped in their own words to *the
  remainder*, but a reader will take them as covering *the row*. Human-reviewed at
  the Phase 28 UAT and accepted; the correction rides the first future edit to
  `retype()`. (3) **WR-32's control-coverage hole**: `dropContained` removes zero
  keys on both sides across all twelve `SEQUENCE` steps, so the symmetric form has
  no green case. The invariant it belongs to is carried by a non-empty by-value
  comparison and is not vacuous, but the missing geometry is worth closing in
  Phase 29's test pass. All three accepted on the record, not silently inherited.

- **Phase 27 carried items (2026-08-27), none blocking Phase 28.** Three deferred
  items survive the phase in `27-shared-seams-extracted/deferred-items.md`:
  `D-27-02-A` — `anno-session.test.ts`'s five plan-18-06 queue tests spawn a real
  `the external analyser` child with no gate, so they FAIL where their gated siblings SKIP
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
  stock VICE loads into the external analyser with the correct RAM content and start
  address, but its displayed machine type is a coincidental default, not a genuine
  read — the snapshot's raw `machine_name` (`"C64SC"`) matches none of
  `file_io.rs`'s four literal match arms. **What this breaks:** the ROADMAP's standing
  "prefer `.vsf` over `.raw`" constraint is unsupported as worded for the machine-type
  field, and Phase 10 criterion 3 (plus any future non-C64 `.vsf` extension of
  `c64-ram-capture`) must verify or explicitly set the system rather than trust
  auto-detection. See `docs/phase9-external-analyser-probe-findings.md` § Accepted
  limits, entry 2.

- **Phase 9 verdict accepted limit — `use_illegal_opcodes` is not the keystroke-
  bootstrap default.** the external analyser's illegal-opcode reassembly passed, but only
  under a direct-JSON-edit override; the fresh bootstrap (criterion 2b) leaves the
  project setting `false`, and auto-analysis does not flip it. **What this breaks:**
  `ANNO-09`'s automated-bootstrap work and any pipeline wanting illegal-opcode-correct
  disassembly must explicitly set `settings.use_illegal_opcodes = true` in the
  generated `.regen2000proj` before exporting or verifying — it does not withhold the
  Phase 10 criterion 4 / `ANNO-06` deletion decision, which was earned against real
  illegal opcodes. See `docs/phase9-external-analyser-probe-findings.md` § Accepted
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
the `.vsf`-as-a-external-analyser-bootstrap-input backlog item (resolved
`wont-fix` 2026-08-22 by Phase 15 plan 15-12, quoting `REQUIREMENTS.md`'s own
Out of Scope line — see `.planning/todos/completed/` for the Resolution), and
the warp-over-RESOURCE_SET
refutation (resolved 2026-08-22 by Phase 15 plan 15-09, see
`.planning/todos/completed/` for the Resolution)); 3 more were opened
by Phase 11.1 itself while dispositioning Phase 10/11's review findings and
building Task 4's completeness guard, which caught undispositioned findings
outside Phase 10/11 too
(the hand-copied ACME/analyser gate migration — resolved 2026-08-22 by
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
total 15 → 14. Task 3 then migrated the three hand-copied ACME/analyser
gates in `anno-cli.test.ts`, `anno-project.test.ts` and
`disasm-roundtrip.test.ts` onto the shared `anno-test-gate.ts` seam (commit
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
**Measured 2026-09-02 (Phase 33 plan 33-02 Task 2), with the broker inactive:**
`npm run test:automated` in `src/mcp/vice` exited **1** with **5 failing tests
across 3 files** (`pass 3019 / fail 5`). Three of the five had a single root
cause — two **completed** `audit`-category todos (the Phase 32 code-review
residue filed 2026-08-31 with twenty-five open findings and 2026-09-01 as round 4
with nine, both already moved to `.planning/todos/completed/`) were still listed
`Pending` as rows in the table below. Those three are
`docs-deferred-ledger.test.ts`'s `AUDIT-04 direction B`, its
`planted violation: both predicates fire` control, and the
`audit-integrity.test.ts` cascade at `no milestone audit declares a gated status
while any docs guard is red` — and all three are closed by this edit, which
removes exactly those two rows and nothing else. The **remaining two**
failures — `anno-register.test.ts`'s `DIRECTION 5 (basis integrity)` and its
`planted violation (the negative control)` — have a different and deliberately
**out-of-phase** root cause: `STORE-01`, `STORE-04`, `STORE-06` and `MCP-04` are
cited by the anno tool register but are no longer declared in
`.planning/REQUIREMENTS.md`, which was rewritten for v0.8.0 and dropped the
v0.7.0 ids. Reconciling those four ids is **not** in Phase 33's scope: they are
v0.7.0 store ids and the correct repair may legitimately be a carried-ids
section in `REQUIREMENTS.md` rather than a code change. No Deferred Items row is
filed for it here on purpose — a row without a matching file under
`.planning/todos/pending/` reds the very two-directional guard this edit
repairs, in the other direction. The expected `test:automated` baseline for the
remainder of Phase 33 is therefore **2 failing tests in `anno-register.test.ts`
alone**; a third failure, or a failure in any other file, is a Phase 33
regression and not this inheritance.

| Category | Item | Priority | Status |
|----------|------|----------|--------|
| broker | 2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path | minor | Pending |
| planning | 2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md | major | Pending |
| testing | 2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host | minor | Pending |
| docs | 2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability | major | Pending |
| store | 2026-08-28-phase-28-review-in-02-fsync-portability-on-windows | minor | Pending |
| store | 2026-08-28-phase-28-review-round-3-five-open-findings | blocker | Pending |
| host-tool | 2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes | minor | Pending |
| paths | 2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools | minor | Pending |
| testing | 2026-09-07-move-all-tests-into-a-separate-test-folder | minor | Pending |
| broker | 2026-09-07-remove-pre-warm-launch-vice-on-first-request | minor | Pending |

*The ledger was empty at the v0.4.0 close; every row above was filed after that
close (one on 2026-08-24, five on 2026-08-26, three on 2026-08-28, one on 2026-08-31, two on
2026-09-01), the first of
them the first pending todo since Phase 17 plan 17-01 emptied the tree. Two rows
filed on 2026-08-29 (`uat-unverified-disposition`, `reopen-phase-28-uat-false-passes`)
were removed the same day: both are complete on disk under
`.planning/todos/completed/`, and `docs-deferred-ledger.test.ts` direction B goes
red on a completed todo still carrying a Pending row here — which is how their
removal was caught, the mirror image of the direction-A cases described below. The
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
env hatch `VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES` in `vice-proxy.ts` (narrow,
inert unless explicitly set, no user-facing surface); the comment-scope gap in
plan 11.1-01's phase-pointer guard (`anno-project.ts`'s one comment-only
FLOW-02 site is permanently outside that guard's string-literal-only reach);
`anno-cli.test.ts`'s harmless duplicate of `writeChain()`'s used-byte formula
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
| deferred_items | 18/deferred-items.md: two load-induced full-suite flakes (broker-e2e, anno-mcp-client) | acknowledged | 2026-08-25 | v0.5.0 |
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

### Acknowledged at the v0.7.0 close (2026-09-01)

The pre-close artifact audit reported **23** open items against **21** already
suppressed by earlier closes. **15 were newly acknowledged through
`query audit-open acknowledge`** — 10 pending todos and 5 phase deferred items.
The remaining **8 could not be acknowledged by any CLI path** and are disclosed
below rather than suppressed; see the writer note.

Acknowledgment is verdict-preserving and self-invalidating: it never rewrites an
artifact's own verdict, and the suppression lapses the moment the artifact's
observed state changes again.

**Counts:** 15 newly acknowledged, 21 carried forward from prior closes, 8
disclosed-but-unsuppressable. `closeout_type=override_closeout`.

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| todos | 2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-26-frame-exact-emulator-stop-is-unowned.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-28-phase-28-review-in-02-fsync-portability-on-windows.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-28-phase-28-review-round-3-five-open-findings.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-08-31-phase-32-review-twenty-five-open-findings.md | (presence-only) | 2026-09-01 | v0.7.0 |
| todos | 2026-09-01-phase-32-review-round-4-nine-open-findings.md | (presence-only) | 2026-09-01 | v0.7.0 |
| deferred_items | 27/deferred-items.md: D-27-02-A — `anno-session.test.ts`'s five plan-18-06 queue tests are ungated | acknowledged | 2026-09-01 | v0.7.0 |
| deferred_items | 27/deferred-items.md: D-27-05-A — `vice-proxy.test.ts` leaks two LISTEN sockets and prevents `node --test` from exiting | acknowledged | 2026-09-01 | v0.7.0 |
| deferred_items | 27/deferred-items.md: D-27-05-B — `contested` is prose-only and Direction 4's prefix scan exempts `note` | acknowledged | 2026-09-01 | v0.7.0 |
| deferred_items | 29/deferred-items.md: `STORE-03`'s traceability status contradicts its own prose (Phase 28, pre-existing) | acknowledged | 2026-09-01 | v0.7.0 |
| deferred_items | 30/deferred-items.md: `repo-root.test.ts` "path agreement" fails inside a `.claude/worktrees/` worktree | acknowledged | 2026-09-01 | v0.7.0 |

**On the 10 todos.** All are real, unfixed, and stay pending — acknowledging a
todo is presence-only and asserts nothing about the work. Two carry milestone
weight rather than bookkeeping weight and are named here so a v0.8.0 planner
finds them without re-reading the ledger:
`2026-08-26-frame-exact-emulator-stop-is-unowned.md` is the blocker STATE.md
already cites for the held Phases 24 and 26, and
`2026-08-31-phase-32-review-twenty-five-open-findings.md` plus
`2026-09-01-phase-32-review-round-4-nine-open-findings.md` are this milestone's
own code-review residue, filed by the final phase rather than fixed in it.

**On the 5 acknowledged `deferred_items`.** None is a requirement gap. Phase 27's
`D-27-02-A` is moot on its own terms — the ungated `anno-session.test.ts` queue
tests it describes were removed with the analyser in Phase 32 — but it is recorded
`acknowledged` rather than `resolved` because promoting a verdict is a stronger
claim than this close is entitled to make on a phase's behalf. Phase 29's entry
routes `STORE-03`'s row/prose contradiction to a Phase 28 verification pass or a
milestone audit; this close ran neither, so it carries forward as stated. Phase
30's is the standing `.claude/worktrees/` limitation already recorded at the
v0.4.0 close as `08.2 D-1` — a third sighting of one defect, not a new one.

**Writer note — the 8 that could not be acknowledged.** All 8 are reported against
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md`,
and **none of them is a deferred item.** They are the data rows of two GFM
evidence tables *inside* that file's narrative entries: the four-run flake tally
in item 3 (`| Run | fail count | failing tests |`) and the orchestrator's
four-test timing verdict table (`| test | observed during | broker live? |
verdict |`). `uat.cjs`'s `parseDeferredTableItems` reads any table row in the
file as an entry — that file's title is an `#` heading, so with no `## Deferred
Items` level-2 heading the whole document is scanned — while its own doc comment
states these are "permanently un-acknowledgeable via the CLI writer — a known,
deliberate limitation", because a table row has no representable `status:` field
to write. `query audit-open acknowledge` refuses each with `not_found`.

The two escapes the parser does offer were both rejected. Entity-encoding the
pipes destroys the rendered tables. Planting a cell reading `resolved` — the move
taken at the v0.5.0 close against Phase 19's guard-exit-code and round-4 flake
tables, which had no verdict column to collide with — would here contradict the
adjacent cells: that same table records `159` and `2410` as **unresolved**, and
the file states one green run "does not *prove*" they are broker-caused. Writing
`resolved` beside `unresolved` in one row would falsify a v0.6.0 evidence record
to quiet a scanner. It was not done.

These 8 will resurface at every future milestone close for as long as Phase 23
sits in `.planning/phases/` — it is not archived here, because v0.6.0 closed
incomplete with Phases 24 and 26 held. A future close should recognise them by
this note and re-disclose rather than re-investigate. The concerns the two tables
actually describe are separately tracked and were acknowledged above:
`2408`/BACK-05 as `2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`.

### Acknowledged at the v0.8.0 close (2026-09-06)

The pre-close artifact audit reported **12** open items against **31** already
suppressed by earlier closes. **4 were newly acknowledged through
`query audit-open acknowledge`** — 1 pending todo, 1 UAT file and 2 phase
deferred items. The remaining **8 could not be acknowledged by any CLI path**
and are disclosed below rather than suppressed; they are the *same* 8 as at the
v0.7.0 close, and the writer note there stands unchanged.

Acknowledgment is verdict-preserving and self-invalidating: it never rewrites an
artifact's own verdict, and the suppression lapses the moment the artifact's
observed state changes again.

**Counts:** 4 newly acknowledged, 31 carried forward from prior closes, 8
disclosed-but-unsuppressable. `closeout_type=override_closeout`.

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| todos | 2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes.md | (presence-only) | 2026-09-06 | v0.8.0 |
| uat_gaps | 36/36-UAT.md | passed — `resolved_by: override`, 0 pending scenarios | 2026-09-06 | v0.8.0 |
| deferred_items | 33/deferred-items.md: D1 — `scripts/check-npm-packages.mjs` is RED, from plan 33-06 | acknowledged | 2026-09-06 | v0.8.0 |
| deferred_items | 35/deferred-items.md: Orchestrator (phase-35 close) — the `audit-root-args.test.ts` flake, culprit named | acknowledged | 2026-09-06 | v0.8.0 |

**On the 1 todo.** `WR-03` is real, unfixed, and stays pending — acknowledging a
todo is presence-only and asserts nothing about the work. It records two holes in
`runHostTool()`'s own stated "nothing throws" invariant, raised by the code review
that ran *after* Phase 34's gap-closure round, and was filed rather than folded in
precisely because it is pre-existing robustness debt rather than a Phase 34 gap.

**On the 1 UAT gap.** Phase 36's `36-UAT.md` carries `status: passed` with **0
pending scenarios** and `resolved_by: override`, accepted by Henrik Olsson on
2026-09-05 with both accepted wordings recorded verbatim in `36-VERIFICATION.md`'s
`overrides:` block. The scanner flags it because it closed by override, not
because anything is outstanding. Both items were owner scope decisions rather than
testable behaviours: `GHID-03`'s forced-conflict control proven on the `flat64k`
route only, and ROADMAP criterion 5's computed-jump requirement met by a
disclosed, cross-corpus-confirmed *absence*.

**On the 2 acknowledged `deferred_items`.** Neither is a requirement gap, and
neither was promoted to `resolved` — the same restraint applied at the v0.7.0
close. Phase 33's D1 entry is moot on its own terms: its text records **RESOLVED
2026-09-03 — closed by plan 33-09, commit `fc199e7`**, and the gate is green. It
is kept rather than deleted because it is the provenance for why
`check-npm-packages.mjs` has an `import type` carve-out at all. Phase 35's entry
names the culprit behind the `audit-root-args.test.ts` flake —
`skill-honesty-checks.test.ts` writes `zz-scratch-in03-negative.md` **inside**
`src/skills/acme-build/`, a directory `check-skill-tool-coverage.mjs` walks, and
Node runs test files concurrently. The fix (`mkdtemp`, the idiom
`dxa-live.test.ts` already uses) is named; no pass owns it. It shares one
mechanism with the 35-03 entry under `resources/vendor/dxa/`.

**Writer note — the 8 that could not be acknowledged: a recurrence, not a new
finding.** All 8 are the same GFM evidence-table rows in
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md`
disclosed at the v0.7.0 close — the four-run flake tally in item 3 and the
orchestrator's four-test timing verdict table. Every acknowledge call refused with
`no deferred item matched --text`. Nothing about the mechanism, the file, or the
two rejected parser escapes changed; the v0.7.0 writer note above is the record
and is not restated here.

What *is* new is the confirmation: this is now the **second consecutive close** to
spend the same effort re-deriving the same refusal. These 8 are permanently and
structurally unclosable by the close procedure for as long as Phase 23 sits in
`.planning/phases/` — and it is not archived, both because v0.6.0 closed
incomplete with Phases 24 and 26 held, and because this project passes
`--no-archive-phases` at every close by the standing v0.4.0 decision. A future
close should recognise them by this note and **re-disclose rather than
re-investigate**. The fix belongs upstream in the scanner, not in this project's
evidence files.

### Carried forward from earlier closes

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Defect | `Drive8Type=0` default on stock broker launch blocked all program loads (`.d64` and bare `.prg` alike) via `c64-ram-capture` (FINDING-C1); fix `-drive8type 1541` at launch | **Fixed** — Phase 8.2 plans 02-04 landed the fix, proved it live, and re-ran the walkthrough to a recorded `pass` | v0.2.0 Phase 8.1 (2026-08-19), fixed in Phase 8.2 (2026-08-19) |
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | **Closed** — v0.4.0 Phase 16 `PKG-02` gave all three scripts tests; `16-VERIFICATION.md` marks it ✓ SATISFIED | v0.2.0 scoping, closed in v0.4.0 Phase 16 (2026-08-23) as `PKG-02` |
| Quality | QUAL-02 — orphaned planning references in source comments | **Closed** — v0.4.0 Phase 16 `PKG-03` removed or repointed them and guarded against reintroduction; `16-VERIFICATION.md` marks it ✓ SATISFIED | v0.2.0 scoping, closed in v0.4.0 Phase 16 (2026-08-23) as `PKG-03` |
| Quality | QUAL-03 — emulator control-plane network exposure | **Closed as accepted risk, not narrowed** — v0.4.0 Phase 16 `PKG-04` (plans 16-02/16-11) recorded disposition `accept`: `PROJECT.md` → Key Decisions carries the dated (2026-08-22) row and `16-PKG04-EVIDENCE.md` grounds it in file:line citations plus a live observed bind (`0.0.0.0:19510`). The exposure itself still exists; REQUIREMENTS.md → `### Control-Plane Bind Follow-on` stays open owned work | v0.2.0 scoping, disposition recorded in v0.4.0 Phase 16 (2026-08-22), bookkeeping closed 2026-08-23 as `PKG-04` |

## Session Continuity

Last session: 2026-09-06T21:30:00Z
Stopped at: Milestone v0.9.0 opened and roadmapped — Phases 39-44, 20/20 requirements
mapped; next action is planning Phase 39, the dual-channel coexistence gate
Resume file: None

Earlier: Phase 38 UAT complete (12/12, 0 issues) — all phases complete, milestone
v0.8.0 ready to close (2026-09-06T11:50:00Z)

Earlier: Phase 38 complete — all phases complete (2026-09-05T19:17:51.515Z)

Earlier: Completed 34-10-PLAN.md
  Plan 34-10 closed CR-05: resolveWorkspacePath() now walks both the workspace
  root and the candidate through an ancestor-realpath walk before comparing,
  returning the real path. 3 tasks, 3 task commits (`ae8d7e1` fix, `790c731`
  test, `b3b4238` test) plus the SUMMARY commit, ~25 min.

Earlier: Completed 28-21-PLAN.md
  Plan 28-21 is complete: 3 tasks, 4 task commits (`f67917a` test/RED,
  `9d292bb` feat/GREEN — WR-21, `df619ad` feat — WR-25, `0a44886` test — the seam
  pin) plus the SUMMARY commit, ~15 min. It is the THIRD plan of the fifth
  gap-closure round, and it closes the two findings where the tree carried a
  claim it did not honour.
  **WR-21**: `addScope` gains the idempotence check every other write entry point
  already had. A byte-identical repeat is an ACCEPTED no-op reporting
  `changed: false` with the revision still advancing — measured as
  `{"revision":1,"changed":true}` then `{"revision":2,"changed":false}` with ONE
  row, where the pre-task tree gave `changed: true` twice and TWO byte-identical
  rows. That is the store-side half of Phase 29's success criterion 5, landed
  here rather than there. It also gains the nesting rule its own doc comment and
  `ScopeRow`'s both already claimed: a nested, containing or partially
  overlapping scope is REFUSED with an `AnnoRangeShapeError` naming BOTH scopes
  (`scope 5120..5376 ($1400..$1500) overlaps the existing scope id=1 4096..8192
  ($1000..$2000) -- ... REFUSED ...`), raised before any write so the table is
  unchanged. Adjacency is explicitly NOT overlap, pinned at `$2000`/`$2001` with
  both rows compared by value. `addScope`'s contradicting `ADDITIVE` paragraph
  was **DELETED, not amended**, in the same commit as the code — 28-07 P3 and
  this round's 28-21 P1 — and `ScopeRow`'s claim gained a one-sentence pointer to
  the refusal that enforces it.
  **WR-25 was DECIDED, not accepted-with-reason.** Workspace confinement is now
  `openStore`'s DEFAULT: an open with neither a `workspaceRoot` nor the new
  `unconfinedModuleDerivedPath: true` escape is refused by name with an
  `AnnoStorePathError`, BEFORE the path is resolved and long before
  `new DatabaseSync`, so `existsSync(path)` reads `false` afterwards — the
  assertion a class-only control would miss. All 8 call sites from the plan-time
  inventory were remedied and the count matched exactly: the four module-derived
  opens in `anno-store.ts` take the escape plus a site comment naming the derived
  value, the two deliberate `anno-store.test.ts` reproductions name it by hand
  with their comments EXTENDED rather than replaced, and
  `anno-durability-mutator.mjs`'s two opens are **CONFINED** via
  `dirname(storePath)` rather than escaped. `storePathWithinWorkspace` is
  byte-unchanged: this plan changes WHEN confinement runs, never WHAT it decides,
  and `anno-confinement.test.ts` is 15/15 on both this plan's trees with case 2's
  inside-pointing symlink still FOLLOWED (28-09 P1 / 28-12 P2) and case 14's real
  root-conditional `{ skip: ... }` untouched (28-17 P4).
  **The escape is pinned** in `anno-seam.test.ts` in the `SEAM_PRIVATE_EXPORTS`
  style: a POSITIVE count of 4 call sites as the primary assertion, an absence
  scan over the `files[]`-derived shipped module set, a non-vacuity companion,
  and a BEHAVIOURAL guard-exists control asserted through the entry point rather
  than against message text so 28-18 P1 is not undone by its replacement.
  NUMBERS: `anno-*.test.ts block-class.test.ts` 209/209 at `# fail 0 /
  # skipped 0`, REAL exit 0 (was 198; the 11 added tests are listed by name in
  the SUMMARY); `anno-store.test.ts` alone 93/93 (was 85); `anno-seam.test.ts`
  22/22 (was 19); `tsc --noEmit` clean; `SCHEMA_VERSION` still 2 and no DDL
  change. PLANTING A (a fifth escape use, `found 5`), PLANTING B (the idempotence
  check deleted) and PLANTING C (the overlap refusal deleted) were each observed
  red on the REAL tree, one hand edit at a time, each restored to an EMPTY
  `git diff --stat -- src/mcp/vice`. TWO DEVIATIONS ARE ON THE RECORD, both
  mechanical: `assert.throws` returns `undefined` in `node:assert`, so the two new
  refusal controls were rewritten to the file's own `try/catch` + `instanceof`
  idiom; and three existing structural assertions matched `openStore` call text
  verbatim (`openStore(staging, { mustExist: true })` and two
  `/return openStore\(storePath\)/`) and were updated to the new call shape with
  their source windows widened 400 -> 700, none weakened or deleted. STORE-01
  stays unmarked — 28-22 also declares it, so `requirements.ready-ids` blocks it
  and `.planning/REQUIREMENTS.md` is untouched. WR-20, WR-23, IN-07 and IN-08
  remain ACCEPT-ONLY and NO code was written for any of them.
  Next: 28-22 (WR-19, the round-5 record, the closing gate).

Earlier: Completed 28-20-PLAN.md
  Plan 28-20 is complete: 3 tasks, 3 task commits (`bf08b30` feat/WR-22,
  `7a63c7c` fix/WR-24, `5f3abc0` feat/WR-18) plus the SUMMARY commit, ~41 min. It
  is the SECOND plan of the fifth gap-closure round, after 28-19's tracer, and it
  closes the three verifier-routed WARNINGs that live in and around `revertTo`.
  **WR-22**: `revertTo`'s `revision` argument is validated as the function's
  first statement, before the pointer-row `select` and before `snapshotPathFor`,
  and the refusal is a NEW `AnnoRevisionArgumentError` — in the `ViceError`
  family, deliberately OUTSIDE the corruption family, asserted per spelling with
  `!(thrown instanceof AnnoStoreCorruptError)`. The before-state was reproduced
  live rather than quoted, and it is worse than the review filed it:
  `revertTo(h, "1")` did not refuse at all — it silently reverted the store,
  closed the caller's handle and returned a handle at revision 1 — while
  `"0001"`, `" 1 "` and `"1.0"` each produced CR-08's corruption message naming
  `r0001.db` / `r 1 .db` / `r1.0.db`. The review's own fix sketch was DECLINED on
  class choice (`AnnoStoreStaleRevisionError` carries the two revisions that
  conflicted, and an argument error has no second revision), and WR-06 was NOT
  widened into — the declination is recorded in the validator's doc comment.
  **WR-24**: the staging name is unique per ATTEMPT from `randomUUID` (the same
  primitive `stageSnapshot` uses), all three cleanups route through
  `discardSnapshot`, and the comment records that WR-11's LEAK half stays OPEN.
  **WR-18**: `pruneSnapshots` returns the sweep's `rollbackFailed` (production
  reader lines `anno-store.ts:1193` and `:2502`, where the plan-time list was
  EMPTY), step 9 records it on the new `AnnoStoreHandle.transactionStateUnknown`,
  the write sequence refuses BY NAME before `begin immediate` with the
  close-and-reopen remedy, and `revertTo` step 6 closes-and-reopens rather than
  returning a handle it cannot vouch for. 28-11 P5 holds and is asserted: the
  accepted write still returns `{"revision":1,"changed":true,...}` with the
  handle's field `false`. NUMBERS: `anno-*.test.ts block-class.test.ts` 198/198 at
  `# fail 0 / # skipped 0`, REAL exit 0 (was 186; the 12 added tests are listed
  by name in the SUMMARY); `anno-store.test.ts` alone 85/85 (was 73);
  `tsc --noEmit` clean; CR-08 re-driven as **69632 -> 69632** with the handle
  still answering. PLANTING D, E and F were each observed red on the REAL tree,
  one hand edit at a time, each reddening exactly the control it targets, each
  restored to an EMPTY `git diff --stat -- src/mcp/vice`. Two `backstop` truths
  are filed with their reasons and no test claims to exercise either: the
  concurrent staging collision, and the `rollbackFailed: true` end-to-end arm.
  STORE-04 stays unmarked — `requirements.ready-ids` reports 0/1 because 28-22
  also declares it, so `.planning/REQUIREMENTS.md` is untouched. ONE ISSUE WORTH
  CARRYING: a planting run BEFORE its task was committed made
  `git checkout -- <file>` revert the whole task; the ordering that makes the
  empty-diff criterion mean anything is commit-then-plant-then-restore. And
  `git diff --stat -- src/mcp/vice` run from INSIDE `src/mcp/vice` matches nothing
  and prints an empty result at exit 0 — indistinguishable from a clean tree.
  Next was: 28-21 (WR-21 + WR-25) — now executed.

Earlier: Completed 28-18-PLAN.md
  Plan 28-18 is complete: 3 tasks, 3 task commits (`ccd80bd` test/RED, `3dde942`
  feat/GREEN, `430fe41` docs) plus the SUMMARY commit (`92dfc37`), ~30 min. It is
  the THIRD and LAST plan of the fourth gap-closure round, and it closes both the
  round and the phase's plan list at 18/18 executed. **WR-15 closed as `fix`**: the
  single-commit-site control matches commit STATEMENTS (an `exec()` call carrying a
  bare statement literal in any of `commit` / `end` / `end transaction`) instead of
  counting the WORD `commit`, proven by two fixture controls over local strings (3
  matches across the spellings where the old matcher gave 1; 0 matches on
  identifiers plus prose where the old matcher gave 1). The defect was OBSERVED,
  not argued: a second fully working `db.exec("end")` site passed the old control
  at `ok 15` / 17-of-17. Its mirror cost was removed with it — `anno-store.ts` no
  longer couples an error message's wording to a control in another file.
  **The round's record is written**: all six round-4 ids carry a `fix` in
  `28-REVIEW.md`'s round-4 disposition table with a number or line reference quoted
  from the carrying plan's SUMMARY, and `anno-store.ts:432`'s `integrity_check`
  throw arm is recorded as an explicit STILL-OPEN carried-forward row. STORE-05 is
  back to `Complete` and STORE-04's recorded reason is corrected to CR-08, both
  transcribed from the round-4 verifier with provenance quoted.
  **The closing gate**: 169/169 anno tests (`# fail 0 / # skipped 0`) at a REAL
  exit code of 0, derived as 28-17's recorded 167 + 2 and observed at 169; `tsc
  --noEmit` clean; 28-15's four named non-vacuity controls re-run individually and
  quoted; this round's three plantings plus criterion 4's planted red each
  re-observed red and reverted with an empty diff; and the CR-08 reproduction
  re-driven through production entry points as **69632 -> 69632** (round 4 recorded
  69632 -> 0) with the handle still answering and a later `openStore` succeeding.
  Both docs guards are 7/7 and 44/44 before AND after — a NON-REGRESSION, and the
  correction that they were never red for the six ids is on the record.
  NEXT: this is the LAST plan of Phase 28. The round is EXECUTED, NOT VERIFIED.
  The code-review gate, the regression gate and the phase verifier all still have
  to run. STORE-04 remains `Gaps Found` (blocker CR-08) and must not be moved by
  anything other than a verification pass.
  Plan 28-17 is complete: 3 tasks, 4 task commits (`37c32e2`, `f652253`,
  `2a5f11a`, `d23197a`) plus the SUMMARY commit (`cda23fd`), 16 min. It is the
  SECOND of the fourth gap-closure round (28-16..28-18). **WR-13, WR-16 and
  WR-14 all closed as `fix`.** WR-13: `stageSnapshot` fsyncs the staged image
  after its `vacuum into` (UNGUARDED -- it removes the destructive half-state, a
  durable row naming bytes that never reached disk) and `publishSnapshot` fsyncs
  the ring directory after its `renameSync` (BEST EFFORT -- it removes only a
  missing directory entry, i.e. an orphan ROW, already inert since 28-13 and
  refused by name since 28-16). That asymmetry is the plan-letter deviation, and
  it is measured: a directory fsync needs the same read bit `readdirSync` needs,
  so at mode 0300 an unguarded one reddens the pre-existing CR-07 control whose
  precondition is a writable-but-unreadable ring. `fsyncPath(` count 4 -> 6;
  `exec("pragma` count 0 before and after; planted red observed
  (`not ok 50 ... 'and publishSnapshot must fsync the ring directory after that
  rename'`) and reverted; `anno-durability.test.ts` still 5/5. WR-16: the
  publish/pointer-row handler, the CR-06 commit handler and the sweep's handler
  each record whether their own `rollback` returned; the two throwing sites
  branch the message on the recorded fact and carry `rolledBack` in `data` (the
  rolled-back wording is kept VERBATIM, the also-failed branch names the open
  transaction and the write lock and still names the revision), and the sweep --
  which must not throw (28-11 P5) -- was WIDENED to
  `{ droppedFiles, deferred, rollbackFailed }` with the field set explicitly at
  all three return sites. Both branches driven through `setDataType` by wrapping
  the handle's own `db.exec`. `anno-seam.test.ts` 17/17, so no new literal
  introduced a bare word `commit` while that control is still word-based.
  WR-14: both root guards moved into node:test's `{ skip: ... }` options with
  byte-identical test names; `SKIPPED as root` 2 -> 0, whole-file
  `assert.ok(\s*true,` 2 -> 0, `skip: process.getuid` 0 -> 2. `sudo -n` needs a
  password here, so uid 0 was FORGED via `NODE_OPTIONS=--import` and the
  pre-task file was run under the identical forgery from its own commit: BEFORE
  `# skipped 0` with both `ok`, AFTER `# skipped 2` with both reasons visible.
  Numbers: 167/167 anno tests (derived 165 + 2), `anno-store.test.ts` 73/73 (was
  71, split 1 + 1 + 0), `tsc --noEmit` clean at every commit. STORE-04 still NOT
  marked Complete -- `requirements.ready-ids` reports 0/1 because 28-18 also
  declares it -- so `.planning/REQUIREMENTS.md` is untouched. NEXT: 28-18 (wave
  16, WR-15 -- the seam's word-based single-commit-site control); it should read
  its expected counts from 28-17's RECORDED ACTUAL (167 across
  `anno-*.test.ts block-class.test.ts`, 73 for `anno-store.test.ts` alone), and
  note that 28-17's new message literals were written against the STILL
  word-based control.
Earlier: Completed 28-16-PLAN.md
  Plan 28-16 is complete: 3 tasks, 4 task commits (`3fb6e4a`, `8cd7c1f`,
  `1cd3453`, `a907fb7`) plus the SUMMARY commit (`ea689d0`), 18 min. It is the
  FIRST of the fourth gap-closure round (28-16..28-18). **CR-08 closed as a
  CLASS by ordering, and WR-17 closed with it.** `revertTo`'s destructive half
  is now unreachable until an `openStore` has succeeded: `openStore` gained a
  JUDGING open (`mustExist` refuses an absent path by name before
  `new DatabaseSync`, and opens `readOnly`, so judging an image can neither
  create nor modify it), and a step 3b opens the STAGED COPY -- the exact bytes
  step 5 renames -- before step 4 closes the caller's handle. The verifier's own
  reproduction re-driven: the live store goes 69632 -> 69632 bytes
  BYTE-IDENTICAL (was 69632 -> 0), the throw is an in-family `AnnoStoreError`
  naming the store path, the snapshot path and `NOTHING has been replaced`, the
  SAME handle still answers `currentRevision() == 3` and `listRanges()`, and a
  later `openStore` succeeds. `retained` is PROMOTED to ONE meaning -- the
  openable image -- so `retainedRevisions()` reports `[0, 2]` where it reported
  `[0, 1, 2]`, and the advertisement and the gate read one witness
  (`snapshotOpenFailure`); both code-scoped `existsSync` counts on a snapshot
  path are 0 (each was 1). No second destroyer: the ring's file sweep now reads
  `claimedRevisions` (the pointer-ROW question), so a corrupt-but-claimed image
  survives at 0 bytes with its row intact as EVIDENCE, and the 32-image cost
  never runs under the sweep's write lock. WR-17: both `openStore` calls after
  the rename are inside handlers reporting a revert that LANDED ON DISK
  (28-11 P5). Numbers: 165/165 anno tests (was 159, split 2 + 3 + 1 as
  planned), `anno-store.test.ts` 71/71 (was 65), `tsc --noEmit` clean, and the
  step 3b planted red observed on BOTH the task-1 tree and the final tree and
  reverted to an empty diff each time. One plan-letter deviation recorded: step
  2's arms split on the pointer ROW, not on the image's presence, because item
  (d) contradicted its own zero-presence-test criteria. The store-identity
  admission stays an OPEN residual (a `SCHEMA_VERSION` bump, T-28-18 `accept`).
  STORE-04 is NOT marked Complete -- `requirements.ready-ids` reports 0/1
  because 28-17 and 28-18 also declare it -- so `.planning/REQUIREMENTS.md` is
  untouched, as 28-16's verification required. NEXT: 28-17 (wave 15, WR-13 +
  WR-16 + WR-14); it should read its expected test counts from 28-16's RECORDED
  ACTUAL (165 across `anno-*.test.ts block-class.test.ts`, 71 for
  `anno-store.test.ts` alone).
Earlier: Completed 28-15-PLAN.md
  Plan 28-15 is complete: 3 tasks, 2 task commits (`4dc258d`, `25e15f4`) plus the
  SUMMARY commit (`0960bd0`), 8 min. It is the THIRD and LAST of the third
  gap-closure round (28-13..28-15). **WR-12 closed at the cause.**
  `pathEntryExists` now takes the confined path as a second parameter and wraps
  its `lstatSync`: `throwIfNoEntry: false` suppresses ENOENT AND NOTHING ELSE,
  so 28-12's otherwise-correct `existsSync` -> `lstat` swap had regressed three
  ORDINARY caller inputs from a named refusal to a bare `Error` outside the
  ViceError family. Measured at BOTH entry points, before and after: six probe
  rows `inViceFamily=false` before (`ENOTDIR` on a regular-file ancestor,
  `EACCES` on an unreadable ancestor, `ELOOP` on an ANCESTOR symlink cycle),
  six `AnnoStorePathError` naming the caller's path after. This closes truth
  12's third clause and the 28-07 P3 comment violation round 3 recorded at
  `anno-types.ts:830-833` -- `realpathOfNearestExisting`'s "every failure is
  rethrown" paragraph is left BYTE-IDENTICAL and is now true of all four
  executable fs call sites in the module. Three new confinement cases (13, 14,
  15) pin the classes at the PRODUCTION entry point as well as at the
  predicate; non-vacuity measured by reverting only `anno-types.ts` (`12 pass /
  3 fail`, the twelve existing cases green in the same run -- that is the
  28-12 P3 evidence). **ONE FINDING CONTRADICTS THE PLAN AND IS RECORDED AS THE
  FINDING:** the manual 40-hop bound is structurally UNREACHABLE in ancestor
  position, because `lstat` must follow a non-final symlink and the kernel's own
  MAXSYMLINKS throws ELOOP before the walk descends once. Both bounds are 40 by
  construction, so they agree on every input; case 15 pins the ancestor spelling
  honestly and asserts the leaf spelling's `40` beside it as the comparison.
  CLOSING GATE, as numbers: **144 pass / 0 fail / 0 skipped across all seven
  `anno-*.test.ts` files with REAL exit code 0** (was 141; round-3 baseline
  135 -- it grew by exactly the three cases added), `tsc --noEmit` clean, one
  `db.exec("commit")` site, `node:sqlite` in one shipped module, both store
  modules still absent from the five-element host-path consumer set, no stderr
  assertion in the diff. The four named non-vacuity controls were re-observed
  ONE AT A TIME rather than as an aggregate (criterion 1's split-orientation
  control and its collapse planting; the exhaustive 65,536-address index
  cross-validation with its `comparisons` assertion; the fully-contained
  overlap case and its filter-and-insert planting; the no-splitter structural
  scan and its STORE-02 non-vacuity companion), and criterion 4's planted red
  was re-observed ON THE FINAL TREE -- with the single commit statement replaced
  by a comment, the combined STORE-04 test and its planted-violation sibling
  both report `not ok` (4 fail / 1 pass, and 28-14's CR-06 control reddens too);
  after restore, `git diff --stat -- src/mcp/vice` is EMPTY and the file is 5/5
  green. STILL OPEN AND DELIBERATELY NOT CLOSED BY THIS ROUND: 28-13's
  prohibition P2 under-claim residual (a second path spelling makes
  `retainedRevisions()` report `[]` while the first ring's files exist), the
  `pragma integrity_check` throw path as a human-verification item, and the
  check-then-open window plus the byte-wise non-normalising comparison as
  stated limits. The whole-glob `npm test` was NOT run and is not a signal for
  this plan. Next: phase verification.

Previously stopped at: Completed 28-14-PLAN.md (CR-06 and CR-07's third property closed); next 28-15
  Plan 28-14 is complete: 3 tasks, 3 task commits (`03a1855`, `777d900`,
  `328cf62`), 14 min. It is the SECOND of the third gap-closure round's three
  plans (28-13..28-15); 28-15 (WR-12, the confinement predicate) remains.
  **CR-06 closed, and proved cross-process.** Step 8's `commitTransaction` --
  the one statement whose failure leaves the transaction OPEN with the CAS, the
  mutation and the pointer row all applied -- now sits inside a handler that
  rolls back (releasing the store's write lock and undoing all three together),
  discards the staging name, rethrows a `ViceError` unchanged and otherwise
  refuses by name stating that nothing was written and the store is still at
  revision N. IN-05's cheap half is folded in on this wrap only (`code` from the
  underlying error); `vice.ts` and `ViceErrorOptions` are untouched, so the
  `cause` half stays out of scope. **CR-07's third property closed:** `revertTo`
  step 6's sweep is wrapped, and on a throw the handler closes the `restored`
  connection (whose transaction state would be unknown) and returns a freshly
  opened handle through `openStore`. A fourth `anno-durability-mutator.mjs`
  mode, `hold-read`, holds a real SQLite SHARED lock in a separate OS process
  behind a marker-file handshake and a hard-capped spin -- the construction that
  makes the contention real rather than simulated. THREE CONTROLS, EACH WITH ITS
  REACH DECLARED AND MEASURED: the cross-process CR-06 test is behavioural and
  discriminating (against `8743bcf` it fails with `expected AnnoStoreError, got
  Error: database is locked`, the review's reproduction verbatim); the
  unreadable-ring `revertTo` control is behavioural but COMPOSITE and
  NON-discriminating for this plan (measured: green with the handler removed);
  the step-6 structural check is a BACKSTOP and is the only control in the tree
  that bites on this edit (measured: it and only it goes red when the handler is
  removed). One deviation worth carrying: the refusal's `data.step` is spelled
  "committing", not "commit", because `anno-seam.test.ts` counts `/\bcommit\b/i`
  over stripped source WITH LITERALS KEPT -- the reason is recorded inline at the
  site so a tidy-up cannot silently redden that control. Gates: 141/141 across
  all seven `anno-*.test.ts` files with real exit code 0 (was 138), `tsc
  --noEmit` clean, one `db.exec("commit")` site, and the whole `anno-store.ts`
  diff is exactly two hunks -- `runWriteSequence`'s `doCommit` branch and
  `revertTo`'s step 6. Zero deletions. The whole-glob `npm test` was NOT run and
  is not a signal for this plan. Next: 28-15.

Previously stopped at: Completed 28-08-PLAN.md (gap closure: CR-02, WR-11 and WR-04 closed); next 28-09
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
  stand under non-`anno` names (`acme-gate.ts`, `block-class.ts`,
  `prg-image.ts`, `shipped-modules.ts`) and the capability-or-glue record is
  committed as `module-classification.ts` (19 entries) with a 16-test enforcing
  guard whose non-vacuity threshold is DERIVED from the registry rather than
  pinned. `package.json`'s `files[]` gained exactly two entries for the whole
  phase; the three test-only new modules are absent. Criterion 4's evidence is
  in `27-05-SUMMARY.md`: broker confirmed stopped, full-glob `npm test`
  (`node --test '*.test.*'`) at 2636 tests / 2520 pass / 44 fail / 67 skipped,
  exit 1 — all 44 pre-existing and dispositioned (5 `anno-session.test.ts`,
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
  mutate+save pair; `anno_get_address_details` is composed client-side from
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
  `.planning/milestones/`), and `absorbed-answer-key.test.ts` reads
  `.planning/phases/11-*/evidence/` unguarded — moving them would turn both
  red. Tagged `v0.4.0`.
Resume file: .planning/phases/32-the-deletion-and-the-grep-gate/32-CONTEXT.md

## Operator Next Steps

- Plan Phase 39 with `/gsd-discuss-phase 39` (or `/gsd-plan-phase 39` to skip discussion)
- Phase 39 is a pre-committed go / degrade / no-go gate whose deliverable is
  **evidence, not code**, and whose verdict selects which serialization shape
  Phase 41 builds. Its rules must be committed before any measurement is taken,
  and `monitor-lock.ts` must not be written in Phase 39 in any shape.
- Phase 40 (the three preprocessing host tools) is fully independent of Phase 39's
  verdict and of the text channel, and can run beside it from day one.
