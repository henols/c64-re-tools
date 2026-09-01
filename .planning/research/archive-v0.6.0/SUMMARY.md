# Project Research Summary

**Project:** c64-re-tools
**Milestone:** v0.5.0 — "The rebuild half — absorbed playbooks, modifiable source"
**Domain:** Persistent MCP session lifecycle + binary-to-rebuildable-source pipeline (C64/6502 reverse engineering)
**Researched:** 2026-08-23
**Confidence:** HIGH for everything grounded in a live source read this session (installed `the external analyser` 0.9.20 crate, ACME 0.97, this repo's own source); MEDIUM for community feature/prior-art conclusions; MEDIUM for the exact packer-identification mechanism and the persistent-session daemon's full failure surface.

## Executive Summary

v0.5.0 turns an annotated `the external analyser` project into rebuildable, subsystem-split, symbol-only ACME source and demonstrates it is actually modifiable — by absorbing the external analyser's own upstream analyze procedures into this project's skills, and by holding a project open across a session instead of respawning the binary per tool call. No new runtime dependency is needed for either half: the persistent session is a straightforward extension of the existing hand-rolled `anno-mcp-client.ts` stdio client, and the multi-file ACME emission is entirely new TypeScript reading the external analyser's existing structured-query tools and rendering ACME text through the already-supported `!source` mechanism — `acme.mjs` needs zero code changes. The right home for the persistent session is a new sibling module inside the already-running `vice-proxy.ts` process, not the host-side VICE broker and not a new supervisor process. The right home for the rebuild pipeline is new CLI verbs following the existing `anno-cli.ts` verb precedent, not new `anno_*` MCP tools.

The single most consequential finding across all four researchers is structural, not stylistic: this project cannot define byte-identity as an acceptance bar even if it wanted to, because unlike every named prior-art disassembly project it has no clean original binary — only a provenance-graded composite with some ranges `HIGH` confidence and others honestly `UNKNOWN`. Behavioural equivalence in VICE via `compare.mjs` is therefore the only well-defined target. But `compare.mjs` itself is unproven for this job: it was built and validated only for same-binary reproducibility, and several of its design choices will produce a false PASS on a real regression or a false FAIL on the milestone's own required modifiability demo. Extending it is first-class scoped work, not a "just call it" integration.

The second consequential finding is that relocation-hazard detection — jump tables, self-modifying code, page-alignment dependence, cycle-exact raster code — does not exist anywhere in this stack or, as far as this research could determine, anywhere in the published C64 disassembly community as a first-class artifact. This must be budgeted as new, bespoke analysis code, not as "wire up a library." Several hazard classes (RTS-trick jump tables with an off-by-one bias, cycle-exact raster chains) reassemble perfectly clean and pass every existing gate while being silently wrong at runtime; only a live VICE observation, not a byte diff, can catch them.

## Key Findings

### Recommended Stack

Everything needed is already a declared dependency, a Node built-in, or an already-installed external binary — no `npm install` required. `analyser --mcp-server-stdio` (not `--mcp-server`/HTTP) is the only collision-free transport: `main.rs:397` hardcodes HTTP to port 3000 with no `--mcp-port`/`--mcp-bind` flag, confirmed by direct source read, while stdio is a private per-caller pipe with no listener at all. The existing hand-rolled client is extended to persist rather than replaced by `@mastra/mcp`'s `MCPClient`, which lacks exit-code-after-close. ACME 0.97 needs no version change: `!source`, `!zone`, and `*=` (confirmed directly against ACME's own shipped `AllPOs.txt`/`QuickRef.txt`) already support exactly the multi-file, cross-referencing, forward-resolving project shape this milestone needs.

**Core technologies:**
- `analyser --mcp-server-stdio` (0.9.20, installed) — persistent-session transport, only mode with no port/collision surface
- Extended `anno-mcp-client.ts` — session primitive, reuses the existing four-way error taxonomy (`AnnoTimeoutError`/`AnnoChildExitError`/`AnnoSessionFailedError`)
- ACME 0.97 "Zem" — assembles the subsystem-split rebuild via `!source`, zero changes needed to `acme.mjs`

**Do not add:** HTTP mode (structurally disqualified by hardcoded port), `@mastra/mcp`'s `MCPClient`, a direct `@modelcontextprotocol/sdk` import, routing the session through `vice-broker.mts`, a general pluggable hazard-detection framework, multi-assembler output, or BASIC token decoding.

### Expected Features

Cross-checked against mature disassembly-to-rebuild practice (pret/pokered, s1disasm, SMBDIS, Crystalis, mwenge/gridrunner, Piddewitt/C64-Game-Source-Code).

**Must have (table stakes), confirmed by every named project:**
- One file per subsystem, wired by the assembler's own include mechanism
- Symbol-only references everywhere — no raw addresses
- Data extracted to its own file(s), separate from code
- Coverage measured, not asserted — directly computable today from existing `anno_get_*` queries
- A relocation-hazard report enumerating what blocks movement, rather than attempting automatic relocation

**Should have:** explicit padding/alignment as a systematic hazard-report entry; a relocation-hazard report as a first-class artifact — no named prior-art project produces one.

**Confirmed anti-features:** C/high-level decompilation output, automatic relocation, auto-renaming with no evidence bar, a GUI, HTML export (cut once already, v0.3.0), non-C64 targets, BASIC token decoding, and byte-identical rebuild as the acceptance bar itself (structurally rejected — no clean original to match against). A narrower, optional pre-modification byte-identical sanity check is fine to keep, distinct from and strictly weaker than the rejected bar.

### Architecture Approach

The persistent session lives as a new sibling module (`anno-session.ts`) holding module-level mutable state inside `vice-proxy.ts` — the same pattern `vice.ts` already establishes — built on an extended `anno-mcp-client.ts`, never a second spawn site. The rebuild pipeline is new CLI verbs (`export-source`, `hazard-report`) following the existing `render-memmap`/`gen-enums` shape: read structured data via a session, render ACME text in pure Node, write files — not post-processing the external analyser's own single-file `--export_asm` output (a named design fork resolved in favor of structured-read-and-render, lower risk than depending on an undocumented private text format).

**Major components:**
1. `anno-session.ts` (NEW) — single-owner, long-lived session handle: spawn-on-first-use, crash detection between calls, transparent restart, serialization. Does not own save timing.
2. `anno-tools.ts` (MODIFIED) — `runAnnoTool()` rewired to call through the session, save-per-mutation invariant preserved byte-for-byte.
3. `anno-rebuild-export.ts` / `anno-hazards.ts` / `anno-provenance-carry.ts` (NEW) — subsystem-split exporter, hazard reporter, provenance-carry adapter.
4. Two new skills — routine-queue-walker (absorbs `analyze-routine`) and rebuild orchestrator (`c64-rebuild`, sequencing export → hazard-report → provenance-carry → `acme-build` → VICE → `compare.mjs`) — with `c64-program-recon`/`c64-memory-mapping` absorbing `-analyze-blocks`/`-analyze-symbol`.

### Critical Pitfalls

1. **`compare.mjs` answers a different question than the milestone needs, and has never been run in the mode required.** Built and proven only for same-binary reproducibility. Its blanket `$D000-$DFFF` mask hides a genuine `$D020`/`$D015`/`$D018` regression; no allowlist exists for the modifiability demo's own intentional change; the checkpoint assumption breaks once code is relocated. Extending it is first-class scoped work.
2. **Relocation hazards that reassemble clean and pass every existing gate while being silently wrong at runtime.** Unmarked data-as-address pointers, indexed jump tables (including the RTS-trick off-by-one idiom), self-modifying code, page-alignment/cycle-exact timing — none detected by any existing tool.
3. **The persistent session inherits every session-lifecycle lesson this project already paid for once**, and re-deriving lighter versions risks reproducing the same bugs with none of the broker's regression tests protecting the new code. Reuse the pattern (single-owner guard, verified-kill, epoch detection), not the broker's code.
4. **Upstream's 7-way concurrent-subagent orchestration is being absorbed at the exact moment the session model it assumes is being replaced.** Default to serializing every write-capable call through one owner; restrict concurrent fan-out to read-only queries.
5. **Coverage criteria are vacuously satisfiable.** "Nothing left `Undefined`" is satisfiable by mechanically auto-labeling everything. Report structural completeness, the Auto/User label ratio, and a sampled independent-reproducibility check as three distinct numbers, never one aggregate percentage.

## Implications for Roadmap

Phase numbering continues from 17; this milestone starts at **Phase 18**. Two "instrument before the work it gates" placements mirror this project's own strongest precedent (v0.4.0's Phase 12 audit-gate-first).

### Phase 18: The enabler — persistent session, proven before anything depends on it
**Rationale:** Every later phase's skills assume a session that survives across many small calls; building them against the old per-call lifecycle first means rewriting them a second time.
**Delivers:** `anno-session.ts`, extended `anno-mcp-client.ts`, `runAnnoTool()` rewired with save-per-mutation preserved byte-for-byte, `anno_read_region` curated, D-32 re-decided, `spawn-seam.test.ts` updated.
**Must include as its own go/no-go gate:** the planted-violation save-discipline test (mutate → kill the child → reopen/re-read from disk → assert persisted; then remove the internal save and prove the test goes red).
**Avoids:** Pitfall 3.

### Phase 19: Absorb the procedures; build the coverage instrument before running the sweep
**Rationale:** A binary partially decomposed under a coverage/hazard instrument that doesn't exist yet cannot be retroactively checked cheaply.
**Delivers:** Five `.agent/skills/` procedures absorbed at a pinned GitHub tag with per-file attribution headers; `c64-program-recon`/`c64-memory-mapping` modified; new `c64-annotate-routines` skill (serialized writes, not the 7-way concurrent model as-authored); `anno-coverage.ts` with Auto/User ratio as a first-class output; packer-identification mechanism spike resolved.
**Depends on:** Phase 18.
**Avoids:** Pitfalls 4, 5, 10.

### Phase 20: Run decomposition to closure on synthetic fixtures
**Rationale:** Execute absorbed procedures against committed synthetic `.prg` fixtures, driven by the coverage instrument, until nothing is left `Undefined`.
**Depends on:** Phase 19.

### Phase 21: The rebuild/export pipeline, and its own gate, before Phase 22 needs it
**Rationale:** Second instrument-before-work application — the reassembly-plus-clean-hazard-report mechanism must exist as the gate Phase 22 runs under.
**Delivers:** `anno-rebuild-export.ts` (`export-source` — one `.a` per anno scope in its own `!zone`, cross-subsystem symbols global; data tables separate), `anno-hazards.ts` (`hazard-report` — the four named hazard detectors), `anno-provenance-carry.ts` (consuming `c64-provenance-diff`'s existing `recovery/RELEASES.json`/`PROVENANCE.md`).
**Depends on:** Phase 20.
**Avoids:** Pitfall 2, Pitfall 7.

### Phase 22: The rebuild skill, modifiability demonstration, and behavioural comparison
**Rationale:** This is exactly what Phase 21's gate exists to check.
**Delivers:** New `c64-rebuild` skill wiring the full pipeline; the modifiability demonstration with a **committed VICE transcript** as the artifact of record (not a described walkthrough); the `compare.mjs` extension (narrowed volatile mask, intentional-difference allowlist, per-binary logical checkpointing, write-trace comparison) run for the first time ever in original-vs-different-binary mode.
**Depends on:** Phase 21's gate.
**Avoids:** Pitfall 1 (single highest-risk gap in the whole milestone), Pitfall 5.

### Phase Ordering Rationale

- Session persistence (18) must precede everything dependent on affordable, cursor-continuous multi-call sequences (19-22).
- Both verification instruments (coverage in 19, hazard-report + reassembly gate in 21) precede the substantial work they measure, preventing "a verification instrument built after the work it should gate."
- The rebuild/comparison work (22) is last because it is what every other phase's instrument exists to gate.
- Provenance-awareness is folded into the export phase (21) since it consumes an already-existing, already-committed artifact — wiring, not new analysis.

### Research Flags

Needs deeper research during planning:
- **Phase 19** — packer-identification mechanism is MEDIUM confidence only; needs a live-source spike (no dedicated read-only "identify packer" tool confirmed in the 28-tool surface).
- **Phase 21/22** — extending `compare.mjs` for original-vs-different-binary comparison has no existing precedent (never run in this mode).
- **Phase 22** — deterministic input replay for behavioural comparison has no VICE-specific tooling located.

Standard patterns, likely skip deep research:
- **Phase 18** — session/save-discipline design is fully specified by this research.
- **Phase 20/21's export mechanics** — ACME's `!source`/`!zone`/`*=` behavior fully confirmed against the installed 0.97 binary's own docs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified live this session against the installed `the external analyser` 0.9.20 source, its live `--help`, and ACME 0.97's own shipped docs. |
| Features | MEDIUM | Community/GitHub sources, cross-checked across 3+ named projects; no primary-vendor docs exist for this domain. The byte-identity-vs-behavioural finding is HIGH within this file. |
| Architecture | HIGH for source-grounded claims; MEDIUM for packer-identification mechanism and the ACME-render-vs-post-process fork (resolved, named explicitly rather than silently picked). |
| Pitfalls | HIGH for 6502/C64 hardware facts and this project's own documented incidents; MEDIUM for the persistent-session daemon's exact failure surface (inferred from the broker precedent, not observed live). |

**Overall confidence:** HIGH on what exists and was read directly; MEDIUM on what must be newly designed (hazard detectors, extended comparator, persistent-session daemon) — appropriate since all three are bespoke work this milestone is first to attempt.

### Gaps to Address

- Deterministic input replay for behavioural comparison — no VICE-specific tooling located; needs a design spike in Phase 22.
- VICE's power-on RAM-fill-pattern resource — referenced qualitatively as a nondeterminism source, never pinned to a specific name/value; needs a live check before the extended comparator is trusted.
- Whether HTTP MCP mode tolerates concurrent connections — moot for the chosen stdio route, but worth a documentation note since it was ruled out structurally, not by measurement.
- The packer-identification exposure mechanism — MEDIUM confidence, needs the Phase 19 spike.
- The exact upstream commit/tag to pin for the five absorbed procedures, and whether their tool-call surface matches the curated tool list — must be diffed explicitly during absorption, not assumed compatible.
- `compare.mjs`'s extended design has zero prior validation — flagged so the roadmapper does not underestimate its size relative to a "just call it" framing.

## Sources

### Primary (HIGH confidence)
- `the external analyser` 0.9.20 installed crate source, read directly: `main.rs`, `mcp/{http,stdio,handler}.rs`, `state/types.rs`, `exporter/asm.rs`, `analyzer.rs`, `packer_signatures.rs`, `Cargo.toml`.
- Live probes: `analyser --help`/`--version`, live `tools/list` (28 tools confirmed), `acme --version`.
- ACME 0.97 shipped documentation (`/usr/share/doc/acme/{QuickRef,AllPOs}.txt`).
- This repo's own source: `anno-mcp-client.ts`, `anno-tools.ts`, `anno-cli.ts`, `anno-launch.ts`, `anno-project.ts`, `spawn-seam.test.ts`, all six `SKILL.md` files, `c64-ram-capture/scripts/compare.mjs`.
- `.planning/PROJECT.md`, `.planning/ARCHITECTURE.md`, `CLAUDE.md`, `.planning/RETROSPECTIVE.md`, `docs/phase9-external-analyser-probe-findings.md`.

### Secondary (MEDIUM confidence)
- [mwenge/gridrunner](https://github.com/mwenge/gridrunner), [mwenge/iridisalpha](https://github.com/mwenge/iridisalpha), [Piddewitt/C64-Game-Source-Code](https://github.com/Piddewitt/C64-Game-Source-Code)
- [pret/pokered](https://github.com/pret/pokered), [crystalisdisassembly](https://github.com/crystalisdisassembly/crystalisdisassembly), [n64decomp/sm64](https://github.com/n64decomp/sm64), [zeldaret/oot](https://github.com/zeldaret/oot), [HackerN64/HackerOoT](https://github.com/HackerN64/HackerOoT)
- [TASVideos Console Verification Guide](https://tasvideos.org/ConsoleVerification/Guide)
- General NMOS 6502/6510 hardware facts, cross-checked against this project's own documented findings.

### Tertiary (LOW confidence)
- None — the packer-identification gap is carried explicitly in "Gaps to Address" rather than asserted at any confidence level.

---
*Research completed: 2026-08-23*
*Ready for roadmap: yes*
