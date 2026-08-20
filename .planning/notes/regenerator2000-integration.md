---
title: regenerator2000 as a static-analysis backend — overlap map, verified removals, and the three upstream blockers
date: 2026-08-17
context: /gsd-explore "what can be removed or needs to be changed and what can be improved if we bring in regenerator2000?"
status: analysis complete; routed to milestone v0.3.0 (ROADMAP.md) + R2000-* requirements
sources:
  - https://regenerator2000.readthedocs.io/en/latest/
  - https://github.com/ricardoquesada/regenerator2000
  - source read at ricardoquesada/regenerator2000@main — src/main.rs, crates/regenerator2000-core/src/mcp/http.rs
---

# regenerator2000 as a static-analysis backend

[regenerator2000](https://github.com/ricardoquesada/regenerator2000) ("r2000") is
an interactive 6502 disassembler for Commodore 8-bits: Rust, TUI, `MIT OR Apache-2.0`,
163 stars, created 2025-12-20, last pushed 2026-08-09. It ships a 28-tool MCP
server, a VICE binary-monitor debugger client, a sandboxed binary unpacker, and
export to four assemblers (64tass, ACME, Kick, ca65) plus HTML.

For scale: it is an order of magnitude healthier than
[barryw/vice-mcp](https://github.com/barryw/vice-mcp) (4 stars, ~17k lines of
patched C), the fork this milestone is building an exit route from.

## Decisions taken in this session

**D-R1 — We keep the VICE socket; r2000 is static-analysis-only.**
r2000 must **never** be launched with `--vice`. Rationale: stock VICE's binary
monitor services exactly one client (standing project constraint), and a second
`connect()` sits unserviced in the backlog with no reply and no EOF —
*indistinguishable from a wedge*. Our broker, pool, warm floor, crash
supervision, container path translation, incident capture and wedge triage all
depend on owning that socket. r2000's own debugger panel is therefore unused
capability, deliberately.

**D-R2 — r2000 is a required prerequisite, not an optional accelerator.**
User decision. Optional-with-detection was rejected because it forbids any
removal (every skill would need a working fallback) and adds a third axis of
conditionality on top of stock-vs-fork.

**D-R3 — Not in v0.2.0.** v0.2.0's thesis is "works on a VICE anyone can
install". Making a `cargo install` prerequisite land inside the milestone whose
Phase 8 deliverable *is* the install story means that phase fights itself.
r2000 lands as v0.3.0 with a hard prerequisite (honouring D-R2). Exactly one
thing folds back into v0.2.0 Phase 8: documenting the never-`--vice` rule, which
is worth doing whether or not r2000 ever lands. Captured as a pending todo.

**D-R4 — r2000 runs container-side (alongside the MCP proxy), not host-side.**
See "Where r2000 runs" below. This is what makes multi-project and devcontainer
use work *today*, without upstream patches and without broker changes.

## Overlap map

| Ours | r2000 equivalent | Verdict |
|------|------------------|---------|
| `acme-build` `disasm` verb | recursive descent + auto-analyzer + ACME export | **Remove.** See below. |
| Phase 4 disassembler (`disasm-opcodes/decoder/renderer`) | Rust disassembler w/ undocumented opcodes | **Keep.** See below. |
| `c64-ram-capture` depack-by-running | sandbox unpacker: Exomizer 1.x/2.x/3.0/3.02+, Dali, ByteBoozer 1.0/2.0, PUCrunch; 100% unp64 benchmark parity; 50M-instruction cap; no VIC-II | **Complementary.** r2000 becomes the fast path, ours the fallback for custom loaders and disk-based loads. |
| `c64-program-recon` | `r2000-analyze-program` / `-blocks` / `-routine` / `-symbol` skills, `get_blocks`, `get_cross_references` | Same intent, opposite substrate — ours observes a running machine, theirs reasons over static structure. Both needed; the tool-selection reference gains an axis. |
| Phase 5 sprite/charset decode | sprite/bitmap/charset views | Overlap in capability only — r2000's viewers are TUI-only, not MCP-exposed. Phase 5's agent-readable ASCII rendering is still required. **Phase 5 does not shrink.** |
| Phase 5 chip-state decode, screenshots | none | Keep. |
| broker, pool, wedge triage, container paths, incident capture | none | Uniquely ours. |
| — | **persistent annotation store**: labels, comments, enums, block types, scopes, undo/redo, project file, `get_symbols`/`get_cross_references`/`search_disassembly` | **Pure gain.** We have no equivalent. |
| — | HTML export with clickable xrefs | Gain. |
| — | `--verify-roundtrip` (export → assemble → diff) | Gain — a built-in reassembly correctness gate. |

## What can be removed (verified, not assumed)

**`acme-build`'s `disasm` verb — yes.** It is a 14-line `spawnSync` wrapper
around `toacme` (`scripts/acme.mjs:208-223`), ACME's own bundled object-to-source
converter. It is not code we maintain. The real cost it carries is documentary:
the ~50-line `## Disassembly` section of `SKILL.md` is almost entirely caveats
that exist *only* because `toacme` does a flat linear decode —

- "strings, tables and the BASIC stub appear as instructions"
- "define the out-of-range labels it emits (`Ld020`, `Lffd2`, ...)"
- "indent its illegal-opcode lines to the operand column"
- the `.dis.a` → `.dis.asm` workaround for the agent's Read tool refusing `.a`

Every one of those disappears against a recursive-descent disassembler with an
auto-analyzer and a real assembler-export path. Removing the verb also drops the
`toacme`-on-PATH prerequisite.

**Phase 4's disassembler — no, it stays.** Verified: its only non-test consumer
is `stock-disassemble.ts`, i.e. `vice_disassemble` against **live RAM at a
checkpoint**. r2000 (static-only by D-R1) reads *files*, not a running machine,
and Phase 5's backtrace needs the opcode table for stack walking. All ~61KB of
source and ~55KB of tests are load-bearing. The work completed 2026-08-17 is not
made redundant.

**Nothing else comes out.** The broker and everything hanging off it has no
r2000 counterpart.

## Three upstream blockers (source-confirmed)

| Blocker | Location | Consequence | Upstream fix |
|---|---|---|---|
| `--mcp-server` is a bare boolean; HTTP port hardcoded to 3000 | `src/main.rs:62-64`; `mcp/http.rs:198` | a second r2000 cannot bind — **no two projects at once** | ~3 lines. `run_server(port: u16, ...)` is *already* parameterized; only the CLI fails to expose it. |
| MCP HTTP binds loopback only — `SocketAddr::from(([127,0,0,1], port))` | `mcp/http.rs:196` | a host-run r2000 is unreachable from another network namespace (devcontainer) | ~2 lines (`--mcp-bind`) |
| `validate_headless_mode()` exits(1) unless the file is `.regen2000proj` | `src/main.rs:141-152` | the **batch-export and stdio-MCP** routes cannot ingest a raw binary | an extension allowlist — see the mechanics below |

The first two are the same shape as the `KEYBOARD_MATRIX_SET` follow-up already
recorded in `PROJECT.md` (genuinely worth upstreaming, not a deliverable here).

### Mechanics of the third — narrower than it first appears

**It does not apply to HTTP MCP mode.** `main.rs:710` computes
`let headless = cli.headless || cli.verify || cli.mcp_server_stdio;` —
`cli.mcp_server` (HTTP) is **not** in that disjunction, so
`validate_headless_mode()` never runs for it.

| Invocation | headless | project file required | TUI runs |
|---|---|---|---|
| `regenerator2000 game.prg` | no | no | yes |
| `regenerator2000 --mcp-server game.prg` | **no** | **no** | **yes** |
| `regenerator2000 --mcp-server-stdio game.prg` | yes | **yes** → exit(1) | no |
| `regenerator2000 --headless --export_asm out.a game.prg` | yes | **yes** → exit(1) | no |

**What the "configuration" in the error message actually is.** From the load
branches in `state/file_io.rs`:

| Format | origin | system | entry point |
|---|---|---|---|
| `.prg` | its own 2-byte header | `prg_data.suggested_system` | `suggested_entry_point` |
| `.vsf` (VICE snapshot) | `$0000` | parsed from `machine_name` | `vsf_data.start_address` |
| `.bin` / `.raw` | **`Addr::ZERO`, hardcoded** (`file_io.rs:125-127`) | none | none |
| `.d64`/`.d71`/`.d81`/`.t64` | — | — | returns a **list** of file entries |

There is no `--origin` and no `--platform` flag in the CLI. So only two cases are
genuinely ambiguous: **raw/bin** (origin unknowable from the bytes) and
**disk/tape images** (which file inside the container). `validate_headless_mode`
is a blunt extension check that protects those by refusing everything that is not
a project file — thereby **over-restricting `.prg` and `.vsf`, both of which are
fully self-configuring.** The human is not needed to supply information; the
allowlist simply never asks whether the information is already in the file.

**The bootstrap that removes the human.** `r2000_save_project` is one of the 28
MCP tools, and `auto_analyze` is a setting checked directly in the load path
(`crate::analyzer::analyze(self)` at `file_io.rs:391`) — no keypress. So:

```
pty + regenerator2000 --mcp-server game.prg   → auto-analyze runs on load
                                              → MCP: r2000_save_project
                                              → game.regen2000proj exists
                                              → every headless batch route unlocks
```

The real requirement is therefore **a pty, once per binary** — automatable with
`script` / `tmux` / `expect` — *not* a human making decisions. **Unverified:**
HTTP MCP mode runs the TUI (`enable_raw_mode` plus a `crossterm::event::read()`
input thread), which may refuse a non-TTY outright. This is the single sharpest
item for `R2000-16`.

**Rejected alternative:** synthesizing a minimal `.regen2000proj` ourselves. It
is serde-serialized (see their `tests/config_serialization_tests.rs`) but
undocumented, and the pty bootstrap above makes it unnecessary.

### `.vsf` is the better bridge than `.raw`

regenerator2000 parses **VICE snapshot files natively** — full memory, machine
type from `machine_name`, and start address. `vice_snapshot_save` already exists
on both backends (`DIRECT-08`, complete). So: depack in the emulator → save a
`.vsf` → hand that to regenerator2000, rather than exporting a flat 64K `.raw`
that lands at origin `$0000` with no override. Note the irony: `.vsf` is
self-configuring and *should* pass headless on its merits — only the extension
allowlist stops it.

## Where r2000 runs

**Container-side, next to the MCP proxy.** This follows from D-R1: with
`--vice` forbidden, r2000 needs nothing from the host — no display, no emulator,
no host paths. It needs workspace files only. Therefore:

- `127.0.0.1:3000` is *correct and private per devcontainer*. The loopback bind
  stops being a blocker.
- Multiple projects = multiple devcontainers = separate network namespaces =
  **the hardcoded port 3000 stops colliding.** No upstream patch needed.
- No `hostpath.ts` / `containerpath.ts` translation on the project-file argument,
  because nothing crosses the boundary. (Had r2000 run host-side, that argument
  *would* need host translation — the mirror image of the screenshot-path trap in
  `DERIV-07`, and a second chance to get that inversion wrong.)
- Cost: a Rust toolchain in the devcontainer image, and no TUI on the host
  display beside VICE.

**The broker is only needed for host-side r2000** — i.e. if you want its TUI on
the host display alongside `x64sc`. That would want the broker's port allocation
and single-owner launch guard, and is **blocked upstream today** by both the
boolean `--mcp-server` and the loopback bind. Revisit if `--mcp-port` /
`--mcp-bind` land.

**Still blocked in every arrangement:** two r2000 projects open in one namespace.
That specifically blocks r2000-assisted two-release diffing in
`c64-provenance-diff`, which is otherwise an attractive improvement. Record as a
known limit, not a plan.

## Two tiers of integration

Most of the value needs **no MCP server at all**. r2000 has batch flags that make
it a plain shell-out, the same shape as `acme-build` calling `acme`/`toacme`:

**Tier 1 — CLI shell-out. Works today, container or host, no ports, no lifecycle.**
`--headless` plus `--export_asm` (ACME among four assemblers), `--export_lbl`,
`--import_lbl`, `--export_html`, `--verify-roundtrip`. This alone covers the
`acme-build disasm` replacement, the DERIV-04 symbol producer, HTML artifacts,
and a reassembly correctness gate. Requires a `.regen2000proj` (TUI once).

**Tier 2 — MCP server, container-side.** Live annotation: `r2000_set_label_name`,
`set_comment`, `set_data_type`, `add_scope`, `create_project_enum`,
`get_cross_references`, `search_disassembly`, `batch_execute`, `save_project`.
One project at a time until `--mcp-port` lands.

Sequencing follows from this: Tier 1 is low-risk and delivers the removals; Tier 2
delivers the annotation store.

## What improves — the actual prize

The disassembler overlap is not the reason to do this. Three loops that currently
do not close are:

1. **Recon output becomes queryable state instead of prose.** Today
   `c64-program-recon` emits Markdown from `templates/memory-map.template.md`,
   which nothing can query, diff, or undo. r2000 gives labels, comments, block
   types, scopes and enums in a project file, with undo/redo, plus
   `get_symbols` / `get_cross_references` / `search_disassembly` over them.

2. **Phase 5's symbol store gains a producer.** DERIV-04 ("load a symbol file and
   have addresses resolved to symbol names") has no upstream today — something
   must *write* those symbols. r2000's `--export_lbl` emits **VICE label files**,
   and `--import_lbl` reads them. Native format on both sides, zero glue:
   annotate in r2000 → export → `vice` resolves live addresses to those names →
   new findings flow back via `--import_lbl`. A round trip, not a one-way dump.

3. **`memmap.json` → r2000 enums.** `c64-memory-mapping` already holds per-bit
   VIC-II/SID/CIA register tables; r2000's enum feature replaces magic numbers
   with semantic names and ships `--dump-enum-files`. Generate r2000 enums from
   our memmap once and every `lda #$1b / sta $d011` in a disassembly
   self-documents. **Neither project can do this alone** — this is the most
   distinctive gain available here.

Plus: `c64-ram-capture` becomes the *bridge* rather than a casualty — depack in
the real emulator (which handles the custom loaders r2000's sandbox cannot), then
hand the result to r2000 for structure. Prefer a **`.vsf` snapshot** over a flat
`.raw`: r2000 parses VICE snapshots natively (memory, machine type, start
address) whereas `.raw` lands at origin `$0000` with no CLI override. And
`c64-provenance-diff` could compare *block classifications* between releases
rather than raw byte offsets — gated on the one-project limit above.

## Costs and open risks

- **Install story regresses on its own axis.** No GitHub release assets exist, so
  install is `cargo install regenerator2000` — a Rust toolchain. This was raised
  and the required-dependency call was reaffirmed (D-R2). Mitigation: watch for
  prebuilt binaries; the project is young (created 2025-12-20).
- **Licensing.** `MIT OR Apache-2.0` (dual-licensed — corrected from an earlier
  single-licence reading here; see `docs/phase9-regenerator2000-probe-findings.md`
  § Corrections, entry 2). Both notices are recorded in
  `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` (plan 10-08).
- **Maturity.** Eight months old. Healthier than the fork we are leaving, but not
  a settled dependency. Stdio MCP transport is documented as
  "experimental/testing only".
- **Verification owed before planning** (`R2000-16`), sharpest first:
  1. Does HTTP MCP mode run under a pty (`script`/`tmux`) with no real TTY? This
     is what decides whether project bootstrap is automatable or a documented
     manual step. Everything downstream depends on the answer.
  2. Does `--export_asm --assembler acme` output reassemble under our
     `!cpu 6510` illegal-opcode expectations? Prefer their `--verify-roundtrip`
     over building our own gate.
  3. Does `--export_lbl` emit a format DERIV-04's symbol store consumes as-is?
  4. Does a `.vsf` from `vice_snapshot_save` load correctly, and does it carry the
     machine type and start address we expect?
  5. Container-side Rust toolchain build time and image-size cost.
