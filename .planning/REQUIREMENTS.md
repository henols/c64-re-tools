# Requirements — Milestone v0.3.0

**Milestone:** v0.3.0 regenerator2000 static-analysis backend
**Created:** 2026-08-19
**Predecessor:** v0.2.0 shipped 2026-08-19 (archived at `milestones/v0.2.0-REQUIREMENTS.md`)

Adopt [regenerator2000](https://github.com/ricardoquesada/regenerator2000) — Rust,
`MIT OR Apache-2.0`, an interactive 6502 disassembler with a 28-tool MCP server — as a
**static-analysis backend only**. It brings three things this project structurally
lacks: a persistent, queryable annotation store; a recursive-descent disassembler
with an auto-analyzer; and a sandboxed binary unpacker.

Grounding document, treated as research already performed:
`.planning/notes/regenerator2000-integration.md` (source-read at
`ricardoquesada/regenerator2000@main`, three upstream blockers confirmed at
file:line, verified overlap map, decisions D-R1..D-R4).

## v0.3.0 Requirements

### Verification (gates the milestone)

- [x] **R2000-16**: Five load-bearing assumptions are checked against a real
      regenerator2000 build **before any further plan is written**, each answered
      in the repo with recorded evidence, and any failure recorded as an accepted
      limit stating what it breaks. Sharpest first, because the first decides
      whether the rest matter:
      1. Does HTTP MCP mode run under a pty (`script`/`tmux`) with no real TTY?
         It calls `enable_raw_mode` plus a `crossterm::event::read()` input
         thread, which may refuse a non-TTY outright. **This answer decides
         whether project bootstrap is automatable at all.**
      2. Does `--export_asm --assembler acme` reassemble under this project's
         `!cpu 6510` illegal-opcode expectations? Prefer their own
         `--verify-roundtrip` over building a gate.
      3. Does `--export_lbl` emit a format `DERIV-04`'s symbol store consumes
         as-is?
      4. Does a `.vsf` from `vice_snapshot_save` load correctly, carrying machine
         type and start address?
      5. Container-side Rust toolchain build time and image-size cost.

### Adoption and boundaries

- [x] **R2000-01**: regenerator2000 is adopted as a **static-analysis** backend and
      is never launched with `--vice`, enforced in code and tested rather than only
      documented. Rationale is a standing project constraint: stock VICE's binary
      monitor services exactly one client, and a second `connect()` sits unserviced
      with no reply and no EOF — indistinguishable from a wedge. The broker, pool,
      warm floor, crash supervision, path translation, incident capture and wedge
      triage all depend on owning that socket.
- [x] **R2000-02**: It runs on the same side of the container boundary as the MCP
      proxy, so **no path translation applies to any argument passed to it** — a
      deliberate *absence*, asserted in a test, and the mirror image of `DERIV-07`
      where translation was wrongly applied. A devcontainer works, and two projects
      open at once work, without any upstream patch.
- [x] **R2000-03**: It is a declared prerequisite named in the install
      documentation alongside VICE, stating the toolchain cost plainly
      (`cargo install regenerator2000` — no upstream release assets exist), with
      its dual `MIT OR Apache-2.0` notice in `THIRD-PARTY-NOTICES.md` (corrected
      from an earlier single-licence reading in this requirement's own text —
      see `docs/phase9-regenerator2000-probe-findings.md` § Corrections, entry 2,
      and plan 10-08's notice).

### Bootstrap and the removal it earns

- [x] **R2000-09**: Project bootstrap from a raw binary is automated rather than a
      documented manual step: a `.prg`, a `.d64` (named entry), or a flat 64K
      capture becomes a `.regen2000proj` without a human. `.vsf` is dropped from
      this requirement's input set and deferred to Phase 11's `c64-ram-capture`
      extension (D-03; see `ROADMAP.md` § Phase 10 criterion 3 for the reason).
      If `R2000-16`(1) fails, this degrades to a documented one-time interactive
      step and every affected playbook says so.
- [x] **R2000-05**: `acme-build`'s `disasm` verb and its `toacme`-on-PATH
      prerequisite are removed, replaced by a regenerator2000 route. This is the
      one deletion the milestone earns: a 14-line `spawnSync` wrapper
      (`scripts/acme.mjs:208-223`) plus ~50 lines of `SKILL.md` caveats that exist
      **only** because `toacme` does a flat linear decode.
- [x] **R2000-06**: A `.prg` or flat 64K capture becomes reassemblable ACME source
      matching this project's `!cpu 6510` expectations, **verified by running the
      assembler** rather than asserted.

### The annotation store — why this milestone exists

- [ ] **R2000-10**: `c64-program-recon` writes labels, comments, block types and
      scopes into queryable annotation state, not only Markdown prose, so a later
      session queries the store instead of re-deriving the findings. Today
      `templates/memory-map.template.md` produces prose that nothing can query,
      diff, or undo.
- [ ] **R2000-11**: A user can ask which addresses reference a given address, and
      search labels, comments and instructions across an analysed program.

### The two things neither project can do alone

- [ ] **R2000-13**: Enum definitions are generated from `c64-memory-mapping`'s
      `memmap.json`, so a disassembly renders per-bit VIC-II/SID/CIA writes with
      semantic names — `lda #$1b / sta $d011` reads as named bits. `memmap.json`
      holds the bit tables; regenerator2000 holds the enum mechanism, installed
      per-project via `r2000_create_project_enum`. (`--dump-enum-files` only
      writes the three built-in enums to a directory and exits — it is a
      TOML-shape discovery tool, not an install path.) **Neither side can
      produce this alone.**
- [ ] **R2000-14**: Symbols annotated in regenerator2000 export as **VICE label
      files** (`--export_lbl`) into the symbol store and resolve live addresses
      through `vice_symbols_load`. Native format on both sides — no glue format to
      invent.
- [ ] **R2000-15**: Names discovered against the running machine flow **back** into
      the store (`--import_lbl`) — a round trip, not a one-way dump. This closes
      the loop `DERIV-04` opened: it had no producer, because something must
      *write* those symbols.

## Future Requirements (deferred, not abandoned)

| ID | Requirement | Why deferred |
|----|-------------|--------------|
| `R2000-07` | HTML export with clickable xrefs | A shareable artifact no skill produces or consumes. Available ad-hoc via `--export_html` regardless. |
| Upstream | regenerator2000 `--mcp-port` / `--mcp-bind` (~5 lines) | Would unblock two projects in one namespace and a host-side TUI. An upstream contribution, not a deliverable here. |
| Upstream | VICE `KEYBOARD_MATRIX_SET` opcode (~60 lines) | Carried from v0.2.0. Closes stock's hardest loss for everyone. |

## Out of Scope (explicit, with reasoning)

- **regenerator2000's own VICE debugger panel** — deliberately unused capability.
  `--vice` is forbidden by `R2000-01`; the broker keeps sole ownership of the
  binary-monitor socket.
- **Retiring Phase 4's disassembler.** Verified, not assumed: its only non-test
  consumer is `stock-disassemble.ts`, i.e. `vice_disassemble` against **live RAM at
  a checkpoint**. regenerator2000 reads *files*, not a running machine, and the
  backtrace needs the opcode table for stack walking. All ~61KB of source and ~55KB
  of tests are load-bearing.
- **Shrinking Phase 5's sprite/charset decode.** regenerator2000's viewers are
  TUI-only, never MCP-exposed, so the agent-readable ASCII rendering is still
  required. Overlap is in capability only.
- **`R2000-04` — two-project limit as a reported error** *(folded 2026-08-17)*.
  Becomes a stated limitation in `R2000-03`'s install documentation. Building
  detection-and-reporting for an upstream port collision is work in the wrong place.
- **`R2000-08` — `.vsf`/`.raw` bridge as its own requirement** *(folded
  2026-08-17)*. Originally reduced to a note on `R2000-09` preferring `.vsf` — it
  carries memory, machine type and start address, whereas `.raw` loads at origin
  `$0000` with no CLI override. **Superseded by D-03** (plan 10-09): `.vsf` was
  dropped from Phase 10's bootstrap input set entirely (see `R2000-09`'s corrected
  text), because the bootstrap never hands regenerator2000 a container format in
  the first place. Flat 64K (`.raw`) is the surviving non-`.prg`/`.d64` route for
  this phase; `.vsf` moves to Phase 11's `c64-ram-capture` extension.
- **`R2000-12` — static-vs-live tool-selection axis** *(folded 2026-08-17)*. Folded
  into v0.2.0's `SKILL-01`, which already rewrites the same playbooks for backend
  routing. One pass over `c64-program-recon`, not two.
- **Two regenerator2000 projects open in one namespace** — blocked upstream by the
  boolean `--mcp-server` and the hardcoded port 3000. This specifically blocks
  r2000-assisted two-release diffing in `c64-provenance-diff`. A known limit, not a
  plan.
- **Synthesizing a `.regen2000proj` ourselves** — it is serde-serialized and
  undocumented, and the pty bootstrap makes it unnecessary.

## Coverage

**12 requirements in scope.** 16 `R2000-*` IDs exist; 4 were cut or folded on
2026-08-17 (`R2000-04`, `-07`, `-08`, `-12`) with rationale above.

## Traceability

*Filled by the roadmap. Every requirement maps to exactly one phase.*

| Requirement | Phase |
|-------------|-------|
| R2000-16 | Phase 9 |
| R2000-01 | Phase 10 |
| R2000-02 | Phase 10 |
| R2000-03 | Phase 10 |
| R2000-09 | Phase 10 |
| R2000-05 | Phase 10 |
| R2000-06 | Phase 10 |
| R2000-10 | Phase 11 |
| R2000-11 | Phase 11 |
| R2000-13 | Phase 11 |
| R2000-14 | Phase 11 |
| R2000-15 | Phase 11 |

**12 / 12 mapped.** Not in this table: `R2000-04`, `-07`, `-08`, `-12` — cut or
folded 2026-08-17, rationale in Out of Scope above and in ROADMAP.md's
"Cut from v0.3.0 scope".
