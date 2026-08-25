# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- ✅ **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-11, 11.1 (shipped 2026-08-21)
- ✅ **v0.4.0 Debt discharged, decisions settled** — Phases 12-17 (shipped 2026-08-23)
- ✅ **v0.5.0 Persistent Session and the Coverage Instrument** — Phases 18-19; 20-22 cut (shipped 2026-08-25)

*v0.5.0 continues phase numbering from Phase 17 — it starts at Phase 18. Phase
numbers are continuous across milestones and never reused, including the
dissolved and cut ones.*

## Standing Constraints

These outlive any one milestone. They were carried out of v0.5.0's archived
phase notes at its close rather than left to be archived with them.

- **A mutate-then-read sequence must not be split across separate connections.**
  Phase 9's recorded incident: doing so produced a `.vsf` snapshot that did not
  contain the bytes just written. A persistent session multiplies how many such
  sequences share one connection, so the discipline has to hold for longer, not
  less. Reuse the VICE broker's session-lifecycle patterns — single-owner
  acquire guard, PID/identity-verified kill, a persisted identity/lease file, a
  fragile no-retry liveness probe distinct from the resilient query path —
  rather than re-deriving lighter versions of each.
- **`.vsf` is not an established bootstrap input.** No shipped requirement
  covers it as one; its recorded home is the backlog item
  [`todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md`](todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md),
  which records why it was deferred. Point at that item, never at a numbered
  phase — the machine-type field only reads correctly by coincidence, matching
  none of the literal `System` arms and falling through to a default.

## Phases

<details>
<summary>✅ v0.2.0 Switchable stock-VICE backend (Phases 1-8, 8.1, 8.2) — SHIPPED 2026-08-19</summary>

**Delivered:** a second, project-selectable backend that drives stock upstream
VICE through its binary monitor — so a user with an apt-installed VICE can run
the six shipped skills, and is told plainly where they must reach for the fork
instead. The stock manifest ships **38** tools against the fork's 62; the gap is
documented rather than hidden.

- [x] Phase 1: Corrected Ground Truth (4/4 plans) — completed 2026-08-12
- [x] Phase 2: Stock Backend Connection (10/10 plans) — completed 2026-08-13
- [x] Phase 3: Direct Tools (18/18 plans) — completed 2026-08-16
- [x] Phase 4: Client-Side Tool Seam and 6510 Disassembler (7/7 plans) — completed 2026-08-17
- [x] Phase 5: Skill-Critical Derived Tools (13/13 plans) — completed 2026-08-17
- [~] Phase 6: Stock-Only Gains — **CUT** 2026-08-17 (no skill calls any of them)
- [x] Phase 7: Cycle Timing and Wedge Triage (18/18 plans) — completed 2026-08-18
- [x] Phase 8: Capability Honesty and the Install Story (6/6 plans) — completed 2026-08-18
- [x] Phase 8.1: Close v0.2.0 audit items (INSERTED) (5/5 plans) — completed 2026-08-19
- [x] Phase 8.2: Close v0.2.0 blockers (INSERTED) (6/6 plans) — completed 2026-08-19

**Shipped and archived 2026-08-19:** 9 phases, 87 plans, 218 tasks, 51/51
in-scope requirements, 8 days. Final audit round 4 — `tech_debt`, no blockers.

**Full phase details, standing constraints, cut-scope rationale and success
criteria:** [`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.2.0-REQUIREMENTS.md`](milestones/v0.2.0-REQUIREMENTS.md)
**Final audit (round 4, `tech_debt`, no blockers):** [`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.3.0 regenerator2000 static-analysis backend (Phases 9-11, 11.1) — SHIPPED 2026-08-21</summary>

**Delivered:** recon findings stop being prose. regenerator2000 is adopted as a
static-analysis backend — a persistent, queryable annotation store plus a
recursive-descent disassembler — reached through **17** curated `r2000_*` tools
and a `vice-mcp r2000 <verb>` CLI, entirely container-side and structurally
incapable of touching VICE. Register writes read as bit names, symbols flow both
ways between the store and a live emulator, and the flat linear `toacme` decoder
it makes obsolete is deleted.

- [x] Phase 9: The Assumption Probe (Go/No-Go) (8/8 plans) — completed 2026-08-20 — verdict `degrade` (rule `R4`), see `docs/phase9-regenerator2000-probe-findings.md`
- [x] Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal (9/9 plans) — completed 2026-08-20
- [x] Phase 11: Annotation Store, Enums, and the Symbol Round Trip (12/12 plans) — completed 2026-08-21
- [x] Phase 11.1: Close v0.3.0 Audit Items (INSERTED) (7/7 plans) — completed 2026-08-21

**Shipped and archived 2026-08-21:** 4 phases, 36 plans, 101 tasks, 12/12
in-scope requirements, 3 days. Final audit round 2 — `passed`, zero open gaps.

**Full phase details, standing constraints, cut-scope rationale, success
criteria and the close-time milestone summary:** [`milestones/v0.3.0-ROADMAP.md`](milestones/v0.3.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.3.0-REQUIREMENTS.md`](milestones/v0.3.0-REQUIREMENTS.md)
**Final audit (round 2, `passed`):** [`milestones/v0.3.0-MILESTONE-AUDIT.md`](milestones/v0.3.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.4.0 Debt discharged, decisions settled (Phases 12-17) — SHIPPED 2026-08-23</summary>

**Goal:** Stop inheriting the same ledger a third time. Every carried item
becomes a fix or a dated decision, and the two questions this project has
answered *by default* each milestone (the fork backend, the Core Value
statement) get answered deliberately.

**Delivered:** the pending-todo tree reads genuinely empty for the first time in
this project's history — **19 inherited items → 0**. Both default answers are now
dated decisions pinned by their own guards (`FORK-01` **retain**, `CORE-01`
**keep-dated**). The instrument that makes any of it checkable was built first
and has been observed refusing a real write: `scripts/audit-gate.mjs`, wired as a
`Write|Edit|Bash` PreToolUse hook, makes a clean audit status impossible over a
red docs guard. External verification replaced the internal proxies on the three
highest-value carried items, and one advertised promise was **refuted** by the
real binary rather than confirmed. The plugin payload moved under `src/` with
both published tarballs still validated.

- [x] Phase 12: Audit Integrity Instrument (7/7 plans) — completed 2026-08-22 — verification 11/11; the live `PreToolUse` dispatch observed refusing all four write routes
- [x] Phase 13: External Verification (5/5 plans) — completed 2026-08-22 — `vice_disk_attach`'s no-side-effect promise refuted against a real binary and corrected at source
- [x] Phase 14: Backend Decision (5/5 plans) — completed 2026-08-22 — `FORK-01` **retain**, with the upstream `KEYBOARD_MATRIX_SET` coupling as the named reversal criterion; the fork's `-mcpserver` transport exercised live for the first time (6/6)
- [x] Phase 15: Debt and Review Disposition (12/12 plans) — completed 2026-08-22 — pending-todo tree 21 → 2, review findings 119 → 150 visible and all dispositioned, Phase 03's last UAT scenario closed by live experiment
- [x] Phase 16: Packaging and Repo Shape (11/11 plans) — completed 2026-08-23 — payload under `src/` in two atomic `git mv`s, `QUAL-01..03` closed, tarball proven byte-identical
- [x] Phase 17: Project Identity and Ledger Close (4/4 plans) — completed 2026-08-23 — `CORE-01` **keep-dated** at a `blocking-human` checkpoint; the ledger reads 0 at the true close

**Shipped and archived 2026-08-23:** 6 phases, 44 plans, 119 tasks, 16/16
requirements (zero cut, zero deferred), 2 days, 292 commits. Final audit round 1
— `tech_debt`, **zero blockers and zero open gaps** (16/16 requirements, 6/6
phases, 12/12 integration, 4/4 flows); what remained was bookkeeping debt and
validation coverage. Closed as `override_closeout`: the pre-close artifact audit's
16 open items were acknowledged rather than resolved — see `STATE.md` →
`### Acknowledged at the v0.4.0 close`.

**Full phase details, success criteria and sequencing rationale:**
[`milestones/v0.4.0-ROADMAP.md`](milestones/v0.4.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.4.0-REQUIREMENTS.md`](milestones/v0.4.0-REQUIREMENTS.md)
**Final audit (round 1, `tech_debt`, no blockers):** [`milestones/v0.4.0-MILESTONE-AUDIT.md`](milestones/v0.4.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.5.0 Persistent Session and the Coverage Instrument (Phases 18-19; 20-22 cut) — SHIPPED 2026-08-25</summary>

**Opened as** "The rebuild half — absorbed playbooks, modifiable source" (Phases
18-22). **Delivered** its first half and cut its second: a regenerator2000
session that survives many tool calls, all five upstream analyze procedures
absorbed and attributed, a seventh skill, and a derived-from-bytes coverage
census that the store's own block table cannot move by a single byte.

- [x] Phase 18: Persistent Session and Tool Surface (7/7 plans) — completed 2026-08-24
- [x] Phase 19: Absorbed Procedures and the Coverage Instrument (20/20 plans) — completed 2026-08-25
- [~] Phase 20: Decomposition to Closure — **CUT** 2026-08-25 (dissolved by the dxa+Ghidra pivot)
- [~] Phase 21: Rebuildable Source and the Reassembly Gate — **CUT** 2026-08-25 (dissolved by the dxa+Ghidra pivot)
- [~] Phase 22: Equivalence and Modifiability — **CUT** 2026-08-25 (dissolved by the dxa+Ghidra pivot)

**Shipped and archived 2026-08-25:** 2 executed phases, 27 plans, 61 tasks,
13/27 requirements. `override_closeout` — the 14 unchecked requirements
(DECOMP-*, BUILD-*, EQUIV-*) all belong to the three cut phases; none was
attempted and failed, and all are re-mapped to v0.6.0 rather than dropped.

**Why 20-22 were cut.** The milestone's second half was written against
regenerator2000 as the analysis substrate. Measurement on a committed 279-byte
fixture showed r2000 unannotated flat-decodes, while dxa recovered 72% of data
bytes with zero false positives and resolved a dispatch table unaided, and
Ghidra — given dxa's map plus volatile I/O blocks — resolved the indirect
dispatch, the self-modifying write, and the index/stride/split-pointer facts.
The goals survive; the substrate does not. Reverses D-R1/D-R2.

**Pivot record and reproduction material:**
[`notes/dxa-ghidra-pivot.md`](notes/dxa-ghidra-pivot.md),
[`notes/auto-annotation-from-ghidra-xrefs.md`](notes/auto-annotation-from-ghidra-xrefs.md),
[`notes/ghidra-volatile-io-and-banking.md`](notes/ghidra-volatile-io-and-banking.md),
[`notes/vic-graphics-map-derivation.md`](notes/vic-graphics-map-derivation.md),
[`notes/dxa-ghidra-pivot-evidence/`](notes/dxa-ghidra-pivot-evidence/)

**Full phase details and success criteria:** [`milestones/v0.5.0-ROADMAP.md`](milestones/v0.5.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.5.0-REQUIREMENTS.md`](milestones/v0.5.0-REQUIREMENTS.md)

</details>

## Progress

**This per-phase table is load-bearing, not decorative.**
`comment-phase-pointers.test.ts`'s `parseCutPhasesFromRoadmap()` parses it to
derive the cut/dissolved phase set that its orphaned-pointer check runs against
— it splits on the `## Progress` heading and reads column 1 (`N.` or `N.M`) and
column 4 (Status) of every row. Collapsing it to a per-milestone summary makes
that set empty and turns four of its tests red. Keep the per-phase rows, keep
the column order, and keep cut/dissolved phases recorded here rather than only
in a milestone archive.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Corrected Ground Truth | v0.2.0 | 4/4 | Complete | 2026-08-12 |
| 2. Stock Backend Connection | v0.2.0 | 10/10 | Complete | 2026-08-13 |
| 3. Direct Tools | v0.2.0 | 18/18 | Complete | 2026-08-16 |
| 4. Client-Side Tool Seam and 6510 Disassembler | v0.2.0 | 7/7 | Complete | 2026-08-17 |
| 5. Skill-Critical Derived Tools | v0.2.0 | 13/13 | Complete | 2026-08-17 |
| 6. Stock-Only Gains | v0.2.0 | — | **Cut** 2026-08-17 | - |
| 7. Cycle Timing and Wedge Triage | v0.2.0 | 18/18 | Complete | 2026-08-18 |
| 8. Capability Honesty and the Install Story | v0.2.0 | 6/6 | Complete | 2026-08-18 |
| 8.1 Close v0.2.0 audit items (INSERTED) | v0.2.0 | 5/5 | Complete | 2026-08-19 |
| 8.2 Close v0.2.0 blockers (INSERTED) | v0.2.0 | 6/6 | Complete | 2026-08-19 |
| 9. The Assumption Probe (Go/No-Go) | v0.3.0 | 8/8 | Complete | 2026-08-20 |
| 10. Adoption Boundaries, Automated Bootstrap, and the Removal | v0.3.0 | 9/9 | Complete | 2026-08-20 |
| 11. Annotation Store, Enums, and the Symbol Round Trip | v0.3.0 | 12/12 | Complete | 2026-08-21 |
| 11.1 Close v0.3.0 Audit Items (INSERTED) | v0.3.0 | 7/7 | Complete | 2026-08-21 |
| 12. Audit Integrity Instrument | v0.4.0 | 7/7 | Complete | 2026-08-22 |
| 13. External Verification | v0.4.0 | 5/5 | Complete | 2026-08-22 |
| 14. Backend Decision | v0.4.0 | 5/5 | Complete | 2026-08-22 |
| 15. Debt and Review Disposition | v0.4.0 | 12/12 | Complete | 2026-08-22 |
| 16. Packaging and Repo Shape | v0.4.0 | 11/11 | Complete | 2026-08-23 |
| 17. Project Identity and Ledger Close | v0.4.0 | 4/4 | Complete | 2026-08-23 |
| 18. Persistent Session and Tool Surface | v0.5.0 | 7/7 | Complete | 2026-08-24 |
| 19. Absorbed Procedures and the Coverage Instrument | v0.5.0 | 20/20 | Complete | 2026-08-25 |
| 20. Decomposition to Closure | v0.5.0 | 0/0 | Cut | 2026-08-25 |
| 21. Rebuildable Source and the Reassembly Gate | v0.5.0 | 0/0 | Cut | 2026-08-25 |
| 22. Equivalence and Modifiability | v0.5.0 | 0/0 | Cut | 2026-08-25 |

**Milestone roll-up:** v0.2.0 — 9 phases, 87 plans, 51/51 in-scope requirements,
shipped 2026-08-19 (audit round 4 `tech_debt`; 13 deferred items at close).
v0.3.0 — 4 phases, 36 plans, 101 tasks, 12/12 in-scope requirements, shipped
2026-08-21 (audit round 2 `passed`, zero gaps; 19 deferred items at close).
v0.4.0 — 6 phases, 44 plans, 119 tasks, 16/16 requirements, shipped 2026-08-23
(audit round 1 `tech_debt`, zero blockers and zero open gaps; **0** pending
todos at close, 16 bookkeeping items acknowledged). v0.5.0 — opened 2026-08-23,
Phases 18-22, 27/27 requirements mapped, not yet shipped. Requirements cut in
earlier milestones stay in their own `milestones/v*-REQUIREMENTS.md` marked
`CUT` with rationale, so restoring one is a scope decision rather than
archaeology.

**Phase directories are not archived.** Unlike the roadmap and requirements,
`.planning/phases/` accumulates across milestones by design.
`docs-review-disposition.test.ts` asserts at least 150 review findings read out
of `.planning/phases/` and explicitly excludes `.planning/milestones/`, and
`r2000-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no
existence guard — archiving them turns both red. Every milestone close therefore
passes `--no-archive-phases`.

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.2.0 shipped and collapsed 2026-08-19 → `milestones/v0.2.0-ROADMAP.md`*
*v0.3.0 shipped and collapsed 2026-08-21 → `milestones/v0.3.0-ROADMAP.md`*
*v0.4.0 shipped and collapsed 2026-08-23 → `milestones/v0.4.0-ROADMAP.md`*
*v0.5.0 roadmap created 2026-08-23 — Phases 18-22, continuing numbering from Phase 17, 27/27 requirements mapped.*
*Phase numbering is continuous across milestones and never reused.*
