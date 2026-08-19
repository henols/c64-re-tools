# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- 📋 **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-10 (proposed, not opened)

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

**Full phase details, standing constraints, cut-scope rationale and success
criteria:** [`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.2.0-REQUIREMENTS.md`](milestones/v0.2.0-REQUIREMENTS.md)
**Final audit (round 4, `tech_debt`, no blockers):** [`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md)

</details>

### 📋 v0.3.0 regenerator2000 static-analysis backend (Proposed)

- [ ] Phase 9: Probe, Bootstrap, and the Removal (TBD plans)
- [ ] Phase 10: Annotation Store, Enums, and the Symbol Round Trip (TBD plans)

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
| 9. Probe, Bootstrap, and the Removal | v0.3.0 | 0/TBD | Not started | - |
| 10. Annotation Store, Enums, and the Symbol Round Trip | v0.3.0 | 0/TBD | Not started | - |

**v0.2.0 final state:** 9 phases, 87 plans, 51/51 in-scope requirements satisfied.
17 requirements were cut wholesale on 2026-08-17 and remain in
`milestones/v0.2.0-REQUIREMENTS.md` marked `CUT` with rationale, so restoring one
is a scope decision rather than an archaeology exercise. Known deferred items at
close: 13 (see `STATE.md` → Deferred Items).

---

# Milestone v0.3.0: regenerator2000 static-analysis backend (PROPOSED)

**Status:** proposed, not opened.
**Dependency on v0.2.0: none, structurally.** regenerator2000 never touches VICE
(D-R1), so it is backend-agnostic — it behaves identically on the fork and stock
backends. The one apparent cross-dependency, Phase 12's symbol round trip needing
`DERIV-04`, is **already satisfied on the fork**: `vice_symbols_load` and
`vice_symbols_lookup` ship today; `DERIV-04` only restores them on *stock*. So
this milestone could run against the fork backend with no v0.2.0 work at all.

**Phase 9's assumption probe (`R2000-16`) may be pulled forward now**, ahead of
v0.2.0 Phases 5-8, and should be. It has no v0.2.0 dependency, it de-risks the
whole milestone for the cost of a day, and — the real reason — it erases the only
genuine rework between the two milestones: v0.2.0 Phase 8 writes the install
story (`DIST-01/02/03`) and revises the playbooks (`SKILL-01`), which v0.3.0 then
rewrites and re-touches. Knowing the probe's answers before Phase 8 lets Phase 8
write those docs **once**, already naming regenerator2000.

**What v0.2.0 still has to finish regardless of this milestone**, because
regenerator2000 replaces none of it: stock advertises 26 tools against the fork's
62, and Phase 5 is that gap (memory search, backtrace, sprites, chip-state
decode, screenshots, symbols). Phase 4's disassembler has one consumer today and
gains its second from Phase 5's backtrace. Phase 7 owns wedge triage on stock;
disk detach (the other half of `DIRECT-06`) was cut from v0.2.0 scope entirely
and is not outstanding work. The entire overlap analysis found
exactly one deletable thing in this codebase: a 14-line `toacme` shim. *(As of
2026-08-19: `tools-manifest.stock.json` ships **38** tools. 26 was the figure at
the 2026-08-17 cut, before Phases 5 and 7 added twelve tools; the fork's 62 is
unchanged.)*

**If v0.3.0 needs to start sooner, defer Phase 6, not 5 or 7.** Phase 6 is
"Stock-Only Gains" — value-add with no parity requirement behind it. Phases 5 and
7 are what make the stock backend usable at all. This holds independently of
regenerator2000.
**Defined:** 2026-08-17 from `/gsd-explore`.
**Grounding:** `.planning/notes/regenerator2000-integration.md` (decisions
D-R1..D-R4, overlap map, source-confirmed upstream blockers).
**Requirements:** `R2000-01`..`R2000-16` in `REQUIREMENTS.md` (proposed block).

## Overview

[regenerator2000](https://github.com/ricardoquesada/regenerator2000) is an
interactive 6502 disassembler for Commodore 8-bits (Rust, TUI, Apache-2.0). It
brings three things this project structurally lacks: a **persistent, queryable
annotation store** (labels, comments, enums, block types, scopes, undo/redo), a
**recursive-descent disassembler with an auto-analyzer** and export to four
assemblers, and a **sandboxed binary unpacker** covering the common C64 packers.

It is adopted as a **static-analysis backend only**. It is never given
`--vice` — our broker keeps sole ownership of stock VICE's binary monitor,
because that monitor serves exactly one client and a second connection is
indistinguishable from a wedge. Everything uniquely ours (broker, pool, warm
floor, crash supervision, container path translation, incident capture, wedge
triage, live-RAM disassembly) is untouched.

The journey runs: prove the four load-bearing assumptions against a real build
and land the batch-CLI route, which is enough to retire `acme-build`'s
`toacme` shim (Phase 9) → stand up the container-side MCP server under the
never-`--vice` guard (Phase 10) → make recon write queryable state and generate
enums from `memmap.json` (Phase 11) → close the symbol round trip with DERIV-04
and finish the install and playbook story (Phase 12).

## Standing Constraints

- **`--vice` is never passed.** Guarded in the launch path, not merely
  documented (`R2000-01`). This is the constraint the whole milestone shape
  follows from.

- **regenerator2000 runs on the MCP proxy's side of the container boundary.** No
  `hostpath.ts` / `containerpath.ts` translation is applied to any argument
  passed to it (`R2000-02`). This is what makes devcontainer use and two
  simultaneous projects work with no upstream patch — separate network
  namespaces mean the hardcoded `127.0.0.1:3000` stops colliding. Note the
  inversion hazard: were it host-side, the project-file argument *would* need
  host translation, the mirror image of the `DERIV-07` screenshot-path trap.

- **Phase 4's disassembler stays.** Its sole non-test consumer is
  `stock-disassemble.ts` — `vice_disassemble` against live RAM at a checkpoint,
  which a file-based static tool cannot serve. Phase 5's backtrace also needs
  the opcode table.

- **Phase 5 does not shrink.** regenerator2000's sprite/bitmap/charset views are
  TUI-only and not MCP-exposed, so the agent-readable ASCII rendering is still
  required.

- **The emulator depack route stays.** regenerator2000's unpacker becomes the
  fast path for the packers it recognises; the emulator handles custom loaders
  and disk-based loads its sandbox cannot.

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
file, after which every headless route unlocks. No human decisions are required.
Whether the TUI tolerates a pty with no real TTY is `R2000-16`(a) and gates
Phase 9.

Consequences carried, not solved: r2000-assisted two-release diffing in
`c64-provenance-diff` is blocked by the first limit, and is documented for the
user (`R2000-04`) rather than worked around. Synthesizing a `.regen2000proj`
ourselves was considered and rejected — it depends on an undocumented serde
format, and the pty bootstrap makes it unnecessary.

## Phases

Two phases, not four. Collapsed 2026-08-17 by the same test applied to v0.2.0:
**does a skill need it, or does something a skill needs depend on it?**

- [ ] **Phase 9: Probe, Bootstrap, and the Removal** - Answer the five load-bearing assumptions against a real build, automate project creation, and retire `acme-build`'s `toacme` shim
- [ ] **Phase 10: Annotation Store, Enums, and the Symbol Round Trip** - Recon writes queryable state, `memmap.json` generates enums, and names flow both ways between the store and the live emulator

### Phase 9: Probe, Bootstrap, and the Removal

**Goal**: The bet is de-risked, project creation needs no human, and the one thing regenerator2000 makes obsolete is gone
**Depends on**: nothing — **may run now, ahead of v0.2.0 Phases 5-8** (see the dependency note above)
**Requirements**: R2000-16, R2000-01, R2000-02, R2000-03, R2000-05, R2000-06, R2000-09
**Success Criteria** (what must be TRUE):

  1. All five assumptions in `R2000-16` are answered against a real build and recorded in the repo, with any failure recorded as an accepted limit stating what it breaks.
  2. A raw `.prg` or a `.vsf` snapshot becomes a `.regen2000proj` **without a human** — HTTP MCP mode under a pty, auto-analysis on load, then `r2000_save_project`. If `R2000-16`(a) fails, this degrades to a documented one-time interactive step and every affected playbook says so.
  3. The launch path **refuses** to pass `--vice`, enforced in code and tested, and no argument passed to regenerator2000 is host-translated.
  4. `acme-build`'s `disasm` verb and its `## Disassembly` section are gone, the `toacme` prerequisite is dropped, and a replacement route producing source that **reassembles** — verified by running the assembler — is documented in its place.
  5. The install documentation names regenerator2000 as a prerequisite, states the toolchain cost plainly, and its Apache-2.0 notice is in `THIRD-PARTY-NOTICES.md`.

**Plans**: TBD

Notes:

- **Criterion 1 gates everything, including whether Phase 10 is worth starting.** Run it first, alone, and read the result before planning further. If regenerator2000 cannot be driven without a human, the annotation store is not reachable from a skill and the milestone should be reconsidered rather than replanned.
- **Run this phase before v0.2.0 Phase 8.** It has no v0.2.0 dependency, and knowing its answers lets Phase 8 write the install story once — already naming regenerator2000 — instead of writing it and then rewriting it here. That is the only genuine rework between the two milestones.
- Criterion 3's "no host translation" is a deliberate *absence*, the mirror image of `DERIV-07` where translation was wrongly applied. Assert it in a test so nobody adds it later.
- Criterion 4 is the entire deletion this milestone earns: a 14-line `spawnSync` wrapper around `toacme` (`scripts/acme.mjs:208-223`) plus ~50 lines of `SKILL.md` caveats that exist only because `toacme` does a flat linear decode. Prefer regenerator2000's own `--verify-roundtrip` over building a reassembly gate — note it implies `--headless`, so criterion 2 comes first.
- Prefer `.vsf` over `.raw` for anything out of the emulator: snapshots carry memory, machine type and start address, while `.raw` loads at origin `$0000` with no CLI override.

### Phase 10: Annotation Store, Enums, and the Symbol Round Trip

**Goal**: Recon findings become state a later session can query, register writes read as names, and names flow both ways between the store and the running machine
**Depends on**: Phase 9, and v0.2.0 Phase 5 for `DERIV-04` on the stock backend
**Requirements**: R2000-10, R2000-11, R2000-13, R2000-14, R2000-15
**Success Criteria** (what must be TRUE):

  1. `c64-program-recon` writes labels, comments, block types and scopes into the annotation store, and a later session queries that store instead of re-deriving the findings from Markdown.
  2. A user can ask which addresses reference a given address, and search labels, comments and instructions across an analysed program.
  3. Enums generated from `c64-memory-mapping`'s `memmap.json` make a disassembly render per-bit VIC-II/SID/CIA writes with semantic names — `lda #$1b / sta $d011` reads as named bits.
  4. Symbols annotated in regenerator2000 resolve live addresses through `vice_symbols_load`, and names discovered against the running machine flow back into the store — a round trip, not a one-way dump.

**Plans**: TBD

Notes:

- Criterion 1 is why this milestone exists. Today `templates/memory-map.template.md` produces prose that nothing can query, diff, or undo.
- Criterion 3 is the most distinctive thing available here — **neither project can do it alone.** `memmap.json` holds the bit tables; regenerator2000 holds the enum mechanism and `--dump-enum-files`.
- Criterion 4 works on the **fork backend today** — `vice_symbols_load` and `vice_symbols_lookup` already ship there. `DERIV-04` (v0.2.0 Phase 5) is what extends it to stock, which is why this phase depends on Phase 5 but this milestone as a whole does not depend on v0.2.0.
- `--export_lbl` / `--import_lbl` are **VICE label files** on both sides. No glue format to invent; if Phase 9's criterion 1(c) found a mismatch, resolve it here.

## Cut from v0.3.0 scope (2026-08-17)

| Cut | Requirements | Why |
|---|---|---|
| Separate MCP-server-standup phase | (was Phase 10) | Wiring is a task inside Phase 9's criterion 3, not a phase. Nothing else was in it once the two-project limit became a documentation line. |
| HTML export with clickable xrefs | `R2000-07` | A shareable artifact no skill produces or consumes. Genuinely nice; not why we are here. Available ad-hoc via `--export_html` regardless. |
| Two-project limit as a reported error | `R2000-04` | Folded into Phase 9's install documentation as a stated limitation. Building detection-and-reporting for an upstream port collision is work in the wrong place. |
| Static-vs-live tool-selection axis | `R2000-12` | Folded into v0.2.0's `SKILL-01`, which is already rewriting the same playbooks for backend routing. One pass over `c64-program-recon`, not two. |
| `.vsf`/`.raw` bridge as its own requirement | `R2000-08` | Reduced to a note on Phase 9 criterion 2 — it is which file extension you hand over, not a deliverable. |

**Net effect:** 4 phases → 2, and 16 requirements → 12 (with 4 folded rather than
abandoned). Phases 11 and 12's numbers are not reused.

## Progress

**Execution Order:** 9 → 10. Phase 9's criterion 1 may run **now**, ahead of
v0.2.0 Phases 5-8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Probe, Bootstrap, and the Removal | 0/TBD | Not started | - |
| 10. Annotation Store, Enums, and the Symbol Round Trip | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.3.0 appended 2026-08-17 as a proposed milestone from `/gsd-explore` — not opened*
