# Requirements: c64-re-tools — Milestone v0.5.0

**Defined:** 2026-08-23
**Milestone:** v0.5.0 "The rebuild half — absorbed playbooks, modifiable source"
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.

**Frame.** This milestone delivers the "and rebuild" half that `PROJECT.md` →
What This Is has claimed since v0.1.x and never shipped: from annotated binary to
source a person can actually change. Phase numbering continues from 17, so this
milestone starts at **Phase 18**.

**Two settled bars, stated once so no requirement below has to restate them:**

- **Byte-identity is not the acceptance bar.** In the user's words: "byte
  identical is nothing I care about but the function of it be identical." The
  research established this is not merely a preference but structural — unlike
  every named prior-art disassembly project, this project has no clean original
  binary to match against, only a provenance-graded composite with some ranges
  `HIGH` confidence and others honestly `UNKNOWN`. "Byte-identical to what?" has
  no well-defined answer here.

- **Proving ground is committed synthetic fixtures only.** No copyrighted game
  image enters this repository. Applying the pipeline to a real title is
  downstream use, not this milestone's evidence.

## v0.5.0 Requirements

### Persistent Session

- [x] **SESS-01**: A regenerator2000 project stays open across many tool calls in one working session instead of being respawned per call, without adding an unguarded spawn site — `r2000-spawn-seam.test.ts`'s enumerated set stays intact and the `--vice` invariant stays guarded in code
- [x] **SESS-02**: A crashed or wedged session is detected between calls and transparently restarted, so a caller sees a recoverable error rather than a hang
- [x] **SESS-03**: Annotations survive a hard kill — every mutating call saves before it returns, proven by a planted-violation test (mutate → kill the child → reopen and re-read from disk → assert persisted; then remove the internal save and prove the same test goes red)
- [x] **SESS-04**: Write-capable calls are serialised through one owner, with concurrent fan-out restricted to read-only queries, so parallel subagents cannot corrupt one session

### Tool Surface

- [x] **SURF-01**: The curated `r2000_*` surface covers what the absorbed procedures actually call — starting with `r2000_read_region`, so a routine can be read at a range instead of exporting the whole program — and the tool-count pin and generated `docs/tool-support.md` move with it without drift
- [x] **SURF-02**: `r2000_get_address_details`'s D-32 refusal is re-decided against the still-live upstream `u16` overflow at `handler.rs:1894` — fixed, worked around, or refused with a documented route, but not carried unexamined a second milestone
- [ ] **SURF-03**: Which packer a binary used is surfaced as a recon finding, so provenance work can use it as evidence and not only as a depack step

### Absorbed Procedures

- [x] **ABS-01**: The five upstream analyze procedures are absorbed into this project's skills at a pinned upstream commit, with their tool calls diffed explicitly against the curated surface so no absorbed step calls a tool this project does not expose — and with no runtime dependency on `.agent/skills/`, which the published crate excludes
- [x] **ABS-02**: Absorbed procedure text is attributed per file and in `THIRD-PARTY-NOTICES.md` under regenerator2000's true dual `MIT OR Apache-2.0` licence
- [ ] **ABS-03**: No two skills contend for the same trigger — every description is checked pairwise across the whole inventory, absorbed and existing, because descriptions *are* the trigger mechanism
- [x] **ABS-04**: The snapshot-versus-drift trade is a dated decision with a named re-sync trigger, not an unstated consequence discovered at the next close

### Coverage Instrument

- [ ] **COV-01**: Coverage is computed from the annotation store and reported as three distinct numbers — structural completeness, the Auto-versus-User label ratio, and a sampled independent-reproducibility check — never collapsed into one aggregate percentage
- [x] **COV-02**: A vacuous pass is detectable: mechanically auto-labelling everything, or commenting every routine "handles data", does not produce a clean report, and multi-caller labels require cross-reference-backed documentation

### Decomposition

- [ ] **DECOMP-01**: Nothing is left `Undefined` on the committed synthetic fixtures — every byte is code, byte, word, address, PETSCII, screencode or table
- [ ] **DECOMP-02**: Every code entry point carries a user-set name and a purpose comment stating function, inputs, outputs and side effects — no `p_XXXX` or `l_XXXX` left
- [ ] **DECOMP-03**: Every referenced non-hardware address is named and documented
- [ ] **DECOMP-04**: Hardware register writes render as named enums rather than magic numbers

### Rebuildable Source

- [ ] **BUILD-01**: Export emits one ACME source file per regenerator2000 scope, wired by `acme-build`'s `!source` and assembling to a single output
- [ ] **BUILD-02**: Data tables are extracted to their own files, so graphics, levels and music can be swapped without touching code
- [ ] **BUILD-03**: Every branch, `JSR`/`JMP` and data reference goes through a symbol, so code can move
- [ ] **BUILD-04**: A hazard report enumerates what blocks movement across four classes — indexed jump tables including the RTS-trick idiom, self-modifying code, page-alignment dependence, and cycle-exact raster code — none of which any existing tool in this stack detects
- [ ] **BUILD-05**: The rebuild is provenance-aware: `c64-provenance-diff`'s verdict is carried to point of use and cracker patches are deliberately excluded rather than inherited
- [ ] **BUILD-06**: Reassembly plus a clean hazard report is a gate that exists before the phase it gates runs, not after

### Equivalence and Modifiability

- [ ] **EQUIV-01**: `compare.mjs` works in original-versus-different-binary mode — narrowed volatile mask so a real `$D020`/`$D015`/`$D018` regression cannot hide, an allowlist for intentional differences, and per-binary logical checkpoints — a mode it has never been run in
- [ ] **EQUIV-02**: Behavioural equivalence between the original and the rebuild is demonstrated in VICE, with a committed transcript as the artifact of record rather than a described walkthrough
- [ ] **EQUIV-03**: Modifiability is demonstrated, not described — one behaviour removed and one added in the rebuilt source, reassembled, both observed taking effect in VICE, transcript committed
- [ ] **EQUIV-04**: The synthetic fixtures are committed and the whole pipeline is runnable in CI

## Future Requirements

Acknowledged, deferred, not in this roadmap.

### Deferred

- **FUT-01**: BASIC token decoding (upstream's `r2000-analyze-basic`) — commercial C64 games captured post-loader almost universally reduce to a one-line `SYS` stub
- **FUT-02**: Concurrent multi-project sessions — blocked upstream: HTTP mode hardcodes port 3000 at `main.rs:397` with no `--mcp-port`
- **FUT-03**: Write-capable concurrent subagent fan-out, as upstream's orchestration authors it — absorbed serialised for now (SESS-04)
- **FUT-04**: Deterministic input replay as a general capability — no VICE-specific tooling located; TASVideos-style movie replay is the nearest precedent
- **FUT-05**: Applying the pipeline to a real title (`bruce_lee`, where two cracked releases and a provenance ledger already exist)

## Out of Scope

Explicitly excluded, with reasoning, to prevent scope creep and re-adding.

| Feature | Reason |
|---------|--------|
| Byte-identical rebuild as the acceptance bar | Structurally undefined here — no clean original exists, only a provenance-graded composite. A *narrower, optional* pre-modification byte-identical sanity check is fine and is not this |
| C or high-level decompilation output | The deliverable is modifiable 6502 assembly; a C rendering is neither reassemblable to the same program nor what a C64 rebuild is edited in |
| Automatic relocation or rebasing | No general solution exists for 6502; the hazard report enumerates what blocks movement instead of pretending to solve it |
| Auto-renaming with no evidence bar | Defeats COV-02 by construction and manufactures confident nonsense — the failure mode `c64-provenance-diff` was built to prevent |
| A GUI, and HTML export | HTML export was already cut once at v0.3.0 (`R2000-07`) as an artifact no skill produces or consumes; still available ad-hoc via `--export_html` |
| Non-C64 targets, and multi-assembler output | No measured caller. ACME is this project's assembler |
| HTTP MCP transport for the session | Structurally disqualified, not merely inconvenient: hardcoded port 3000, no port flag |
| Routing the session through `vice-broker.mts` | The broker exists to cross the container/host boundary for `x64sc`; regenerator2000 is container-side and has no such boundary. Reuse its single-owner pattern, not its code |
| The two upstream contributions (`KEYBOARD_MATRIX_SET`, `--mcp-port`/`--mcp-bind`) | Unchanged from v0.4.0 — pull requests against projects this repo does not own |
| A copyrighted game image in this repository | Synthetic fixtures only; keeps the pipeline CI-runnable and the repo distributable |

## Traceability

Populated by roadmap creation (`/gsd-new-project` → roadmapper, 2026-08-23).
Every v0.5.0 requirement maps to exactly one phase; none are orphaned or
duplicated. Full phase Goals/Depends-on/Success-Criteria live in
`.planning/ROADMAP.md` → "Phase Details".

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 18 | Complete |
| SESS-02 | Phase 18 | Complete |
| SESS-03 | Phase 18 | Complete |
| SESS-04 | Phase 18 | Complete |
| SURF-01 | Phase 18 | Complete |
| SURF-02 | Phase 18 | Complete |
| SURF-03 | Phase 19 | Pending |
| ABS-01 | Phase 19 | Complete |
| ABS-02 | Phase 19 | Complete |
| ABS-03 | Phase 19 | Pending |
| ABS-04 | Phase 19 | Complete |
| COV-01 | Phase 19 | Pending |
| COV-02 | Phase 19 | Complete |
| DECOMP-01 | Phase 20 | Pending |
| DECOMP-02 | Phase 20 | Pending |
| DECOMP-03 | Phase 20 | Pending |
| DECOMP-04 | Phase 20 | Pending |
| BUILD-01 | Phase 21 | Pending |
| BUILD-02 | Phase 21 | Pending |
| BUILD-03 | Phase 21 | Pending |
| BUILD-04 | Phase 21 | Pending |
| BUILD-05 | Phase 21 | Pending |
| BUILD-06 | Phase 21 | Pending |
| EQUIV-01 | Phase 22 | Pending |
| EQUIV-02 | Phase 22 | Pending |
| EQUIV-03 | Phase 22 | Pending |
| EQUIV-04 | Phase 22 | Pending |

**Coverage:**

- v0.5.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-08-23*
*Last updated: 2026-08-23 — roadmap created, all 27 requirements mapped to Phases 18-22*
