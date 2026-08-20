# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- 🚧 **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-11 (open, planning)

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

### 🚧 v0.3.0 regenerator2000 static-analysis backend (Open)

- [x] **Phase 9: The Assumption Probe (Go/No-Go)** - Answer the five load-bearing assumptions against a real regenerator2000 build and record an explicit verdict on whether the milestone proceeds — verdict `degrade` (rule `R4`), see `docs/phase9-regenerator2000-probe-findings.md`
- [ ] **Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal** - Guard `--vice` in code, run container-side with no path translation, turn a raw binary into a project without a human, and retire the `toacme` shim
- [ ] **Phase 11: Annotation Store, Enums, and the Symbol Round Trip** - Recon writes queryable state, `memmap.json` generates enums, and names flow both ways between the store and the live emulator

## Progress

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
| 10. Adoption Boundaries, Automated Bootstrap, and the Removal | v0.3.0 | 8/9 | In Progress|  |
| 11. Annotation Store, Enums, and the Symbol Round Trip | v0.3.0 | 0/TBD | Not started | - |

**v0.2.0 final state:** 9 phases, 87 plans, 51/51 in-scope requirements satisfied.
17 requirements were cut wholesale on 2026-08-17 and remain in
`milestones/v0.2.0-REQUIREMENTS.md` marked `CUT` with rationale, so restoring one
is a scope decision rather than an archaeology exercise. Known deferred items at
close: 13 (see `STATE.md` → Deferred Items).

---

# Milestone v0.3.0: regenerator2000 static-analysis backend

**Status:** open — planning. Three phases: 9, 10, 11.
**Opened:** 2026-08-19 (numbering continues from v0.2.0, which ran 1-8 plus
inserted 8.1 and 8.2).
**Defined:** 2026-08-17 from `/gsd-explore`; re-shaped to three phases 2026-08-19
when the probe was split out as a standalone gate.
**Grounding:** `.planning/notes/regenerator2000-integration.md` (decisions
D-R1..D-R4, overlap map, source-confirmed upstream blockers, pty bootstrap
mechanics, the two integration tiers). Treated as research already performed —
do not re-derive it.
**Requirements:** the 12 in-scope `R2000-*` items in `REQUIREMENTS.md`. Four of
the original 16 (`R2000-04`, `-07`, `-08`, `-12`) were folded or cut on
2026-08-17; see "Cut from v0.3.0 scope" below.

**Dependency on v0.2.0: none, structurally.** regenerator2000 never touches VICE
(D-R1), so it is backend-agnostic — it behaves identically on the fork and stock
backends. The one apparent cross-dependency is **Phase 11's** symbol round trip
needing `DERIV-04`, and that is **already satisfied on the fork**:
`vice_symbols_load` and `vice_symbols_lookup` ship there today. `DERIV-04`
(v0.2.0 Phase 5, complete) is what extends the round trip to *stock*. So this
milestone could have run against the fork backend with no v0.2.0 work at all.

## Overview

[regenerator2000](https://github.com/ricardoquesada/regenerator2000) is an
interactive 6502 disassembler for Commodore 8-bits (Rust, TUI, Apache-2.0). It
brings three things this project structurally lacks: a **persistent, queryable
annotation store** (labels, comments, enums, block types, scopes, undo/redo), a
**recursive-descent disassembler with an auto-analyzer** and export to four
assemblers, and a **sandboxed binary unpacker** covering the common C64 packers.

It is adopted as a **static-analysis backend only**. It is never given `--vice` —
our broker keeps sole ownership of stock VICE's binary monitor, because that
monitor serves exactly one client and a second connection is indistinguishable
from a wedge. Everything uniquely ours (broker, pool, warm floor, crash
supervision, container path translation, incident capture, wedge triage,
live-RAM disassembly) is untouched.

The journey runs: **answer the five assumptions against a real build and record a
go/no-go verdict** (Phase 9) → **land the adoption boundaries, the automated
bootstrap and the one deletion this milestone earns** (Phase 10) → **stand up the
annotation store, generate enums from `memmap.json`, and close the symbol round
trip** (Phase 11).

### Why the probe is its own phase

`R2000-16`'s failure mode is *reconsider the milestone*, not *replan the phase*.
If regenerator2000 cannot be driven without a human, the annotation store is
unreachable from a skill and the whole thesis is in question. A note inside a
larger phase makes that gate skippable; a phase boundary makes it structural.

This project learned the same lesson four times during v0.2.0, in escalating
forms: a test written by the pass that wrote the code proves less than it looks
like it does, and only the external check — a real assembler, a real emulator, a
real container, a real broker launch — finds what the internal one cannot. Phase
8.1 is the cleanest instance: running the one unwitnessed claim **falsified it**,
exposing a real product defect (`Drive8Type=0`) rather than a documentation gap.
Phase 9 exists so this milestone starts where that one ended.

### Sequencing: the two integration tiers

From the grounding notes, and it is what determines the Phase 10 / Phase 11 split:

| Tier | Mechanism | Delivers | Risk |
|---|---|---|---|
| **Tier 1** — CLI shell-out | `--headless` plus `--export_asm` / `--export_lbl` / `--import_lbl` / `--verify-roundtrip`. No ports, no lifecycle; the same shape as `acme-build` calling `acme`. Requires a `.regen2000proj` to exist. | the `acme-build disasm` removal, the reassembly gate, and `DERIV-04`'s missing symbol producer | **low** |
| **Tier 2** — MCP server, container-side | `r2000_set_label_name`, `set_comment`, `set_data_type`, `add_scope`, `create_project_enum`, `get_cross_references`, `search_disassembly`, `batch_execute`, `save_project`. One project at a time until `--mcp-port` lands upstream. | the annotation store — why this milestone exists | higher |

**Tier 1 → Phase 10. Tier 2 → Phase 11.** Do the low-risk tier that earns the
removals first; the annotation store follows.

Note the ordering hazard inside Phase 10: `--verify-roundtrip` implies
`--headless`, which requires a `.regen2000proj`. The bootstrap (`R2000-09`)
therefore lands before the reassembly verification (`R2000-06`), not beside it.

## Standing Constraints

Apply to every phase of this milestone. They are not repeated as per-phase
success criteria.

- **`--vice` is never passed.** Guarded in the launch path and tested, not merely
  documented (`R2000-01`). This is the constraint the whole milestone shape
  follows from: stock VICE's binary monitor services exactly one client, and a
  second `connect()` sits unserviced with no reply and no EOF —
  indistinguishable from a wedge.

- **regenerator2000 runs on the MCP proxy's side of the container boundary**
  (D-R4). No `hostpath.ts` / `containerpath.ts` translation is applied to any
  argument passed to it (`R2000-02`). This is what makes devcontainer use and two
  simultaneous projects work with no upstream patch — separate network namespaces
  mean the hardcoded `127.0.0.1:3000` stops colliding. Note the inversion
  hazard: were it host-side, the project-file argument *would* need host
  translation, the mirror image of the `DERIV-07` screenshot-path trap.

- **regenerator2000 is a required prerequisite, not an optional accelerator**
  (D-R2). Optional-with-detection was rejected: it forbids any removal, since
  every skill would need a working fallback, and it adds a third axis of
  conditionality on top of stock-vs-fork.

- **Phase 4's disassembler stays.** Verified, not assumed: its sole non-test
  consumer is `stock-disassemble.ts` — `vice_disassemble` against live RAM at a
  checkpoint, which a file-based static tool cannot serve. The backtrace also
  needs the opcode table for stack walking. All ~61KB of source and ~55KB of
  tests are load-bearing.

- **Phase 5 does not shrink.** regenerator2000's sprite/bitmap/charset views are
  TUI-only and not MCP-exposed, so the agent-readable ASCII rendering is still
  required. The overlap is in capability only.

- **The emulator depack route stays.** regenerator2000's unpacker becomes the
  fast path for the packers it recognises; the emulator handles the custom
  loaders and disk-based loads its sandbox cannot. `c64-ram-capture` becomes the
  *bridge*, not a casualty.

- **Prefer `.vsf` over `.raw` for anything leaving the emulator.** VICE snapshots
  are parsed natively and carry memory, machine type and start address;
  `.bin`/`.raw` loads at origin `$0000` (`file_io.rs:125-127`) with no `--origin`
  flag to override it.

## Known upstream limits (not this milestone's work)

Source-confirmed at `ricardoquesada/regenerator2000@main`:

| Limit | Location | Effect |
|---|---|---|
| `--mcp-server` is a bare boolean, HTTP port hardcoded 3000 | `src/main.rs:62-64`, `mcp/http.rs:198` | two projects in one namespace cannot coexist. `run_server(port: u16)` is already parameterized — a ~3-line CLI fix upstream |
| MCP HTTP binds `127.0.0.1` only | `mcp/http.rs:196` | a host-side regenerator2000 is unreachable from a devcontainer. Sidestepped by D-R4, not fixed |
| headless refuses non-`.regen2000proj` | `src/main.rs:141-152` | the batch-export and stdio-MCP routes cannot ingest a raw binary. **Does not affect HTTP MCP mode** — `main.rs:710` omits `cli.mcp_server` from the headless disjunction |

The third limit is narrower than its error message suggests. Only `.bin`/`.raw`
(origin hardcoded to `Addr::ZERO`, `file_io.rs:125-127`, and no `--origin` flag
exists) and disk/tape images (which file inside the container?) are genuinely
ambiguous. `.prg` and `.vsf` are self-configuring — origin, system and entry
point all come from the file — and are over-restricted by a blunt extension
check. The route through it is a **bootstrap under a pty**: `--mcp-server <raw
binary>` loads and auto-analyses (`auto_analyze` is checked in the load path at
`file_io.rs:391`, no keypress), then `r2000_save_project` writes the project
file, after which every headless route unlocks. No human *decisions* are
required — only a pty, once per binary.

Whether the TUI tolerates a pty with no real TTY (`enable_raw_mode` plus a
`crossterm::event::read()` input thread) is **`R2000-16`(1), and it is Phase 9's
gate for the whole milestone.**

Consequences carried, not solved: r2000-assisted two-release diffing in
`c64-provenance-diff` is blocked by the first limit, and is documented for the
user (`R2000-03`'s install documentation, per the `R2000-04` fold) rather than
worked around. Synthesizing a `.regen2000proj` ourselves was considered and
rejected — it depends on an undocumented serde format, and the pty bootstrap
makes it unnecessary.

Also carried: the install story regresses on its own axis. No upstream release
assets exist, so install is `cargo install regenerator2000` — a Rust toolchain.
Accepted when D-R2 was reaffirmed; mitigation is to watch for prebuilt binaries,
since the project was created 2025-12-20.

## Phase Details

### Phase 9: The Assumption Probe (Go/No-Go)

**Goal**: The five load-bearing assumptions are answered against a real regenerator2000 build, and a recorded verdict says whether v0.3.0 proceeds as scoped, degrades, or should be reconsidered
**Depends on**: Nothing — no v0.2.0 dependency, and it runs against either backend
**Requirements**: R2000-16
**Success Criteria** (what must be TRUE):

  1. A real regenerator2000 build is present and identified in this environment, with its version recorded and the container-side toolchain cost — build time and image-size delta — **measured rather than estimated** (`R2000-16`(5)).
  2. The pty question is answered by *running* it: `--mcp-server <raw binary>` under `script`/`tmux` with no real TTY is observed either to serve MCP requests or to refuse, and whether `r2000_save_project` then produces a `.regen2000proj` that a subsequent `--headless` invocation loads is recorded with its transcript (`R2000-16`(1)).
  3. The three downstream assumptions are each answered against real artifacts, not source reading: `--export_asm --assembler acme` output reassembles under this project's `!cpu 6510` expectations (preferring their own `--verify-roundtrip` over building a gate); an unmodified `--export_lbl` file is handed to `vice_symbols_load` and either consumed as-is or not; and a `.vsf` written by `vice_snapshot_save` loads carrying the expected machine type and start address (`R2000-16`(2)(3)(4)).
  4. Every answer is recorded in the repo as evidence a later session can re-read, and every failure is recorded as an **accepted limit naming what it breaks** — no assumption is left standing on inference.
  5. A **go/no-go verdict is recorded** naming which of three routes the milestone takes: **proceed** as scoped; **degrade** — bootstrap becomes a documented one-time interactive step, every affected playbook says so, and Phase 10/11 scope is amended accordingly; or **reconsider** the milestone, because a regenerator2000 that cannot be driven without a human puts the annotation store out of a skill's reach and with it this milestone's thesis.

**Plans**: 8 plans in 5 waves
**Wave 1**

- [x] 09-01-PLAN.md — Evidence scaffold, illegal-opcode `.prg` fixture, third-party install authorization, and the real build's version (criterion 1, first half)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — Container-side toolchain cost measured as two numbers: single-stage build cost and multi-stage shipped-image cost (criterion 1(5))
- [x] 09-03-PLAN.md — **The gate within the gate.** pty tolerance, MCP served-or-refused, and the keystroke-driven Save-As bootstrap (criterion 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-04-PLAN.md — Reassembly via regenerator2000's own `--verify` gate against a real `acme`, with the illegal-opcode mode recorded (criterion 3(2))
- [x] 09-05-PLAN.md — `--export_lbl` seeded, exported, grammar-matched against `stock-symbols.ts`, and handed unmodified to a live `vice_symbols_load` (criterion 3(3))
- [x] 09-06-PLAN.md — A real `.vsf` produced, loaded, and **interrogated** for machine type and start address (criterion 3(4))

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 09-07-PLAN.md — `docs/phase9-regenerator2000-probe-findings.md`, the machine-readable verdict, and the research corrections (criteria 4 and 5)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 09-08-PLAN.md — Verdict discoverability: STATE.md decision entry and ROADMAP pointers (criterion 5)

Notes:

- **This phase is the gate, and its verdict is an artifact, not a judgement held in a head.** Criterion 5 is what makes the gate structural rather than skippable. Read it before planning Phase 10.
- Criterion 2 is the sharpest item and is ordered first among the five for that reason — it decides whether `R2000-09` is automatable at all, and therefore whether Phase 10 delivers a bootstrap or a documented manual step.
- Do not write Phase 10 or Phase 11 plans before this phase closes. `R2000-16`'s own wording is "before any further plan is written".
- Nothing here builds product. If the probe wants throwaway scripts, they are evidence, not deliverables.
- **Verdict recorded: `degrade`, rule `R4` fired** (triggering input: `c3_4_vsf_load: partial`; criteria 1, 2a, 2b, 3(2) and 3(3) all passed). Full evidence, all seven criteria and the reproduced decision rule: `docs/phase9-regenerator2000-probe-findings.md` — Phase 10's planner reads this document's frontmatter `verdict` key as the gate before writing any Phase 10 plan.

### Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal

**Goal**: regenerator2000 is a guarded, declared, container-side prerequisite that turns a raw binary into an analysed project without a human — and the one thing it makes obsolete is gone
**Depends on**: Phase 9 — its recorded go/no-go verdict shapes criterion 3
**Requirements**: R2000-01, R2000-02, R2000-03, R2000-09, R2000-05, R2000-06
**Success Criteria** (what must be TRUE):

  1. The launch path **refuses** to pass `--vice`, enforced in code and pinned by a test that fails if the flag is reintroduced — the broker keeps sole ownership of the binary-monitor socket.
  2. **No** argument passed to regenerator2000 is host-translated. The absence is asserted in a test so nobody adds translation later, and it is the mirror image of `DERIV-07`, where translation was wrongly applied. A devcontainer run works with no upstream patch.
  3. A `.prg` or a `.vsf` becomes a `.regen2000proj` **without a human** — or, if Phase 9's verdict was *degrade*, it is a documented one-time interactive step that every affected playbook names at its point of use. Either way the state is honest at the surface a user reads.
  4. `acme-build`'s `disasm` verb, its `## Disassembly` caveat section, and its `toacme`-on-PATH prerequisite are gone, replaced by a regenerator2000 route whose output is proven reassemblable **by running a real assembler**, not asserted.
  5. The install documentation names regenerator2000 as a required prerequisite alongside VICE, states the `cargo install` toolchain cost and the one-project-per-namespace limit plainly, and its Apache-2.0 notice is in `THIRD-PARTY-NOTICES.md`.

**Plans**: 9 plans in 6 waves

**Wave 1**

- [x] 10-01-PLAN.md — Adoption boundaries: the `--vice` guard, unreachable by construction and denied by scan, plus the no-translation absence assertion (criteria 1-2, R2000-01/R2000-02)
- [x] 10-02-PLAN.md — Automated bootstrap: environment drift re-check and the minimal, forced-settings `.regen2000proj` synthesiser (criterion 3, R2000-09)
- [x] 10-03-PLAN.md — `.d64` named-entry extraction, container-side, that refuses to guess (criterion 3, R2000-09, D-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 10-04-PLAN.md — The CLI seam: `vice-mcp r2000 …` as an argv subcommand on the published bin, verified end to end (criterion 3, R2000-09/R2000-02, D-06)

**Wave 3** *(blocked on Wave 2)*

- [x] 10-05-PLAN.md — The reassembly proof: regenerator2000's own `--verify`, keyed on the parsed ACME line and never the exit code (criterion 4, R2000-06)

**Wave 4** *(blocked on Wave 3)*

- [x] 10-06-PLAN.md — The removal: `disasm` verb, the `## Disassembly` caveats, the `toacme` prerequisite, and the replacement pointers (criterion 4, R2000-05)

**Wave 5** *(blocked on Wave 4)*

- [x] 10-07-PLAN.md — The scaffold ACME can actually assemble, proven in CI (folded todo 2)
- [x] 10-08-PLAN.md — Install story: README prerequisite section, the dual-licence notice, and the inverted honesty guard (criterion 5, R2000-03)

**Wave 6** *(blocked on Wave 5)*

- [ ] 10-09-PLAN.md — Doc truth-up: criterion-3 wording, the Apache-2.0-only corrections, the wedge-triage contention discriminator, and both folded todos closed (D-03/D-14)

Notes:

- **This is Tier 1 — CLI shell-out.** No ports, no lifecycle, the same shape as `acme-build` calling `acme`. Low risk, and it is what earns the removal.
- Criterion 3 before criterion 4: `--verify-roundtrip` implies `--headless`, which requires the project file to already exist.
- Criterion 4 is the entire deletion this milestone earns — a 14-line `spawnSync` wrapper around `toacme` (`scripts/acme.mjs:208-223`) plus ~50 lines of `SKILL.md` caveats that exist *only* because `toacme` does a flat linear decode: strings and tables rendered as instructions, out-of-range labels needing hand definitions, illegal-opcode lines needing re-indentation, and the `.dis.a` → `.dis.asm` Read-tool workaround. All of them disappear against a recursive-descent disassembler with an auto-analyzer.
- Criterion 5's install-story work is the one place this milestone re-touches v0.2.0 Phase 8's output. Expect to edit, not to rewrite.
- The two-project limit is *documented* here (the `R2000-04` fold), not detected and reported. Building detection for an upstream port collision is work in the wrong place.
- **Phase 9's recorded verdict is `degrade`, rule `R4`** — full evidence at
  `docs/phase9-regenerator2000-probe-findings.md`. The bootstrap itself is **not**
  affected: criteria 2a/2b (pty tolerance, keystroke-driven Save-As bootstrap) both
  passed cleanly, so criterion 3 above proceeds as scoped, a real automated bootstrap,
  not a documented manual step. Two amendments land here instead, each beside the
  criterion they touch, not in place of it:
  - **Criterion 3, and the ROADMAP's standing "prefer `.vsf` over `.raw`" constraint
    (§ Standing Constraints, above):** do not trust regenerator2000's auto-detected
    machine-type field from a `.vsf` load — traced to a coincidental default
    (findings doc § Accepted limits, entry 2). Verify or explicitly set the machine
    type instead. RAM content and start address are unaffected and remain reliable
    from a `.vsf`.
  - **Criterion 4's deletion decision:** still earned — criterion 3(2) passed
    against real illegal opcodes. But any generated `.regen2000proj` this criterion's
    bootstrap produces must explicitly set `settings.use_illegal_opcodes = true`
    before export/verify; the keystroke bootstrap leaves it `false` by default and
    auto-analysis does not flip it (findings doc § Accepted limits, entry 1).

### Phase 11: Annotation Store, Enums, and the Symbol Round Trip

**Goal**: Recon findings become state a later session can query, register writes read as names, and symbols flow both ways between the store and the running machine
**Depends on**: Phase 10; plus one backward dependency on v0.2.0 Phase 5's `DERIV-04` (see note below)
**Requirements**: R2000-10, R2000-11, R2000-13, R2000-14, R2000-15
**Success Criteria** (what must be TRUE):

  1. `c64-program-recon` writes labels, comments, block types and scopes into the annotation store, and a **later session answers a question by querying that store** instead of re-deriving the findings from Markdown prose.
  2. A user can ask which addresses reference a given address, and can search labels, comments and instructions across an analysed program.
  3. Enums generated from `c64-memory-mapping`'s `memmap.json` make a disassembly render per-bit VIC-II/SID/CIA writes with semantic names — `lda #$1b / sta $d011` reads as named bits — and the generation is re-runnable from `memmap.json` rather than a one-off hand edit.
  4. A symbol annotated in regenerator2000 resolves a live address through `vice_symbols_load`, and a name discovered against the running machine flows **back** into the store via `--import_lbl` — demonstrated as one closed loop on one real program, not as two independent one-way dumps.

**Plans**: TBD

Notes:

- **The one backward dependency in this milestone.** `DERIV-04` (v0.2.0 Phase 5, complete) is what extends the symbol round trip to the *stock* backend. It **already works on the fork today** — `vice_symbols_load` and `vice_symbols_lookup` ship there — so this phase depends on Phase 5 while the **milestone as a whole does not depend on v0.2.0**.
- **This is Tier 2 — the container-side MCP server.** Higher risk than Phase 10, and it is why this milestone exists.
- Criterion 1 is the prize. Today `templates/memory-map.template.md` produces prose that nothing can query, diff, or undo.
- Criterion 3 is the most distinctive thing available here — **neither project can do it alone.** `memmap.json` holds the per-bit tables; regenerator2000 holds the enum mechanism and `--dump-enum-files`.
- Criterion 4 closes the loop `DERIV-04` opened: it had no producer, because something must *write* those symbols. `--export_lbl` / `--import_lbl` are **VICE label files** on both sides, so there is no glue format to invent. If Phase 9's criterion 3 found a format mismatch, it is resolved here.
- One project at a time, until `--mcp-port` lands upstream. Plan around it rather than working around it.
- **Phase 9's criterion 3(3) (`--export_lbl` format match) is `pass`, not a mismatch** —
  see `docs/phase9-regenerator2000-probe-findings.md` § Accepted limits, entry 3. The
  "if a format mismatch, it is resolved here" contingency two lines above does not
  trigger; no amendment lands on this phase from the Phase 9 verdict. The `pass` is
  scoped to a single fixture and regenerator2000 0.9.20, so criterion 4 above should
  still treat it as "compatible for the format observed," not "for all inputs forever."

## Cut from v0.3.0 scope (2026-08-17)

Still valid. Four of the sixteen `R2000-*` requirements were folded or cut, and
one proposed phase was dissolved into a task.

| Cut | Requirements | Why |
|---|---|---|
| Separate MCP-server-standup phase | (was a phase of its own) | Wiring is a task inside the adoption phase, not a phase. Nothing else was in it once the two-project limit became a documentation line. |
| HTML export with clickable xrefs | `R2000-07` | A shareable artifact no skill produces or consumes. Genuinely nice; not why we are here. Available ad-hoc via `--export_html` regardless. |
| Two-project limit as a reported error | `R2000-04` | Folded into Phase 10's install documentation as a stated limitation. Building detection-and-reporting for an upstream port collision is work in the wrong place. |
| Static-vs-live tool-selection axis | `R2000-12` | Folded into v0.2.0's `SKILL-01`, which already rewrote the same playbooks for backend routing. One pass over `c64-program-recon`, not two. |
| `.vsf`/`.raw` bridge as its own requirement | `R2000-08` | Reduced to a note on Phase 10 criterion 3 — it is which file extension you hand over, not a deliverable. Prefer `.vsf`: it carries memory, machine type and start address. |

**Net effect:** 16 requirements → 12, with 4 folded rather than abandoned. The
original four-phase shape collapsed to two on 2026-08-17, then re-split to three
on 2026-08-19 when `R2000-16` was promoted from a criterion inside Phase 9 to a
standalone go/no-go phase. The dissolved phase numbers are not reused.

## Coverage

All **12** in-scope requirements map to exactly one phase. No orphans, no
duplicates.

| Phase | Requirements | Count |
|-------|--------------|-------|
| 9. The Assumption Probe (Go/No-Go) | R2000-16 | 1 |
| 10. Adoption Boundaries, Automated Bootstrap, and the Removal | R2000-01, R2000-02, R2000-03, R2000-09, R2000-05, R2000-06 | 6 |
| 11. Annotation Store, Enums, and the Symbol Round Trip | R2000-10, R2000-11, R2000-13, R2000-14, R2000-15 | 5 |
| **Total** | | **12 / 12** |

Not counted: `R2000-04`, `-07`, `-08`, `-12` — cut or folded 2026-08-17, see
above.

## Progress

**Execution Order:** 9 → 10 → 11. Phase 9 is a **go/no-go gate**: its recorded
verdict decides whether 10 and 11 proceed as scoped, degrade, or are
reconsidered. No Phase 10 or 11 plan is written before Phase 9 closes.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. The Assumption Probe (Go/No-Go) | 8/8 | Complete | 2026-08-20 |
| 10. Adoption Boundaries, Automated Bootstrap, and the Removal | 0/9 | Planned | - |
| 11. Annotation Store, Enums, and the Symbol Round Trip | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.3.0 appended 2026-08-17 as a proposed milestone from `/gsd-explore`*
*v0.3.0 opened 2026-08-19 as three phases (9, 10, 11), numbering continued from
v0.2.0. `R2000-16` split out of Phase 9's body into a standalone go/no-go phase:
its failure mode is reconsider-the-milestone, not replan-the-phase, and a phase
boundary makes that gate structural rather than skippable.*
