# Research Summary: v1.0.0 "The Rebuild Half"

**Project:** c64-re-tools  
**Domain:** Static 6502/C64 reverse-engineering rebuild pipeline (annotated binary → multi-file ACME source → reassembled program → behavioral equivalence verification)  
**Researched:** 2026-09-10  
**Confidence:** HIGH (all claims grounded in source code inspection, external documentation, or measured absence; design recommendations are evidence-based, not theoretical)

---

## Executive Summary

The rebuild half of c64-re-tools v1.0.0 is achievable with **zero new npm runtime dependencies and zero new host prerequisites**, layering four genuinely novel capabilities (multi-file ACME generation, swappable data tables, movement-hazard detection, behavioral-equivalence comparison) onto existing infrastructure this project already owns: the annotation store, real-ACME byte-diff oracle, dxa/Ghidra decoding, and v0.9.0's runtime execution-evidence layer.

The stack recommendation is ACME 0.97 "Zem" (unchanged from existing `acme-build`), Node ≥24 (unchanged), and extension of existing modules rather than new dependencies. The architecture is settled: export lives in the `anno_*` family, hazard detection is a computed query (never a store table), and both routes reuse proven infrastructure.

**One genuine disagreement emerges from research that must NOT be resolved by the roadmapper:** FEATURES.md recommends building the synthetic fixture early, *before* the hazard-detection phase, so both hazard detection and modifiability proof can be developed against a real subject from day one. PITFALLS.md instead recommends sequencing the fixture *with* BUILD-04's hazard-detector phase, because a fixture built ahead of the detector risks being written to match the detector's own assumptions rather than to test them independently (this project measured exactly this failure mode once already, on the coverage instrument: four verification rounds, each finding new gameability). Both positions are reasoning from real incident history and deserve equal weight in the roadmap's sequencing decision. **Present both to the roadmapper and let the owner decide.**

The milestone's governing constraint ("the tool reports, the end-user decides what gets reverse-engineered") means no phase may silently drop, filter, or exclude any byte from a binary. Every feature must surface data for human decision, never decide for the user. Phases BUILD-05 and BUILD-07 encode this explicitly and must not be circumvented.

---

## Key Findings

### Recommended Stack

**Zero new dependencies.** Every capability needed for the rebuild half is reachable by extending code this project already owns:

- **ACME 0.97 "Zem"** — assembler, unchanged from existing `acme-build` skill. Multi-file generation via the `!source "name.a"` directive (cwd-relative, not library-search) and `!binary` for extracted data tables are core ACME semantics, documented and proven against this project's existing byte-diff oracle (`acme-verify.ts`).
- **Node ≥24 (MCP server) / ≥18 (installer)** — unchanged. No v1.0.0 feature requires a newer Node API; the work is pure string/array/binary manipulation over existing `node:fs` and `Uint8Array`.
- **Existing .annostore** — already has schema members: `anno_scope` for scope boundaries, `external_file` type for extracted tables (currently unused), four split-address types for lo/hi table pairs, `anno_evid_exec` for runtime-evidence-informed hazard detection.
- **`anno-export-asm.ts`** — the one place annotation-store rows + image bytes become ACME source text; extend for multi-file + lossless invariant, never duplicate.
- **`acme-verify.ts` byte-diff oracle** — real-ACME verification with three-outcome design (ok/failed/skipped), already proven against false-pass hazards. Reuse, never re-mint.
- **`anno-coverage.ts`'s `scanIndirectDispatch()`** — proven detector for RTS-trick idiom (Class 1 hazard), including `splitTableCandidates` advisory bucket explicitly designed for hazard reporting.
- **`capture-pair.mjs` + `compare.mjs`** — frame-exact capture and classified comparison, already shipped in v0.9.0. Run in original-versus-rebuilt mode (never exercised before) to demonstrate behavioral equivalence.
- **`vice_cpu_history` (`chis`)** — per-entry cycle counts from real stock VICE, shipped and parseable in v0.9.0. Use for cycle-exact-raster hazard corroboration (flagging, not proving).

**Critical real-world blocker found in existing code:** `host-tool.mts`'s `acme.build` spawn sets no `cwd` — ACME resolves every bare `!source "name.a"` relative to the broker process's inherited working directory. This is harmless today (exporter never emits `!source`); it becomes load-bearing for v1.0.0. **Must add `cwd: outDirPath` to the spawn call.** Without this, multi-file exports silently resolve to stale or missing files from an unpredictable directory.

### Expected Features

All 15 requirements committed to PROJECT.md: `DECOMP-01`..`04`, `BUILD-01`..`07`, `EQUIV-01`..`04`.

**Table stakes (decomposition to closure):**
- `DECOMP-01`: Zero `Undefined`-typed bytes — measure and drive to zero with structured classification.
- `DECOMP-02`: Semantic naming of entry points — `routine-queue-walker` skill already exists for this workflow.
- `DECOMP-03`: Every non-hardware address named and documented — cross-reference union (`STORE-06`) already exists.
- `DECOMP-04`: Hardware register enums — by-hand route (`anno_create_project_enum`) is the only documented path.

**Table stakes (rebuildable export):**
- `BUILD-01`: One ACME file per scope, `!source`-wired, assembling to one `.prg`.
- `BUILD-02`: Data tables in separate, swappable `.bin` files — `external_file` type exists unused.
- `BUILD-03`: Universal symbolization — every branch/JSR/JMP/data reference through named symbol, not raw hex.
- `BUILD-06`/`BUILD-07`: Reassembly gate + lossless export — byte-diff oracle reused, movement-mode always exercised.

**Table stakes (hazard detection):**
- `BUILD-04`: Hazard report across four classes (RTS-trick, self-modifying code, page-alignment, cycle-exact raster) — **no prior art exists as reusable tools**. Must build four detectors from existing data, plus three-valued output (`ok` / `flagged-hazard` / `unclassified`), never boolean.

**Table stakes (provenance + behavioral equivalence):**
- `BUILD-05`: Provenance verdict carried to point of use as visible metadata/comments, not tool-decided.
- `EQUIV-01`: `compare.mjs` in original-versus-rebuilt mode with narrowed volatile mask.
- `EQUIV-02`: Behavioral equivalence demonstrated with committed VICE transcript.
- `EQUIV-03`: Modifiability proof through code the hazard report or movement work actually touched.
- `EQUIV-04`: Pipeline runnable in CI with committed synthetic fixture.

**Differentiator:** `DECOMP-01`'s completeness gate must query `anno_evid_disagreements` as required, not optional.

### Architecture Approach

Export path lives entirely in the `anno_*` MCP tool family, extending `anno-export-asm.ts` in place. Hazard report is a computed, read-only query (new pure module `anno-hazards.ts`) that never opens or modifies the store. Class 1 (RTS-trick) reuses `scanIndirectDispatch()` from `anno-coverage.ts`; Classes 2-4 (SMC, page-alignment, raster-timing) are new.

**Critical architectural hazard:** ACME's `!source "name.a"` resolves relative to the broker's working directory. Set `cwd: outDirPath` in `acme.build` spawn (Answer 2, ARCHITECTURE.md).

File ordering must be deterministic (address-based), with drift guard asserting byte-identical output on re-export.

### Critical Pitfalls

Research identified 21 pitfalls; most severe:

1. **Reassembly gate on wrong signals** (Pitfalls 1-4) — Never trust exit status or fixed output path. Reuse `acme-verify.ts`'s three-outcome design, always test movement.

2. **Hazard detector validated only against itself** (Pitfalls 7, 15, 16) — Cross-check against independently-sourced fixtures (`tracer.prg`, `bank.prg`, `smc.prg`), deliberately include non-canonical variants.

3. **Behavioral equivalence never observed failing** (Pitfall 17) — Require paired red transcript showing comparison catches deliberately-broken rebuild.

4. **Modifiability through untouched code** (Pitfall 18) — Behavior must be routed through code hazard report flagged or movement work moved.

5. **Runtime evidence layer left on the shelf** (Pitfall 6) — Make `anno_evid_disagreements` query required, not optional.

---

## Implications for Roadmap

### Phase 1: Decomposition to Closure (`DECOMP-01`..`04`)

**Rationale:** Must happen first — every later phase assumes classified and named subject.  
**Delivers:** Synthetic fixture with zero `Undefined` bytes, semantic names, hardware enums.  
**Critical:** Integrate `anno_evid_disagreements` as part of completeness gate; capture/execute fixture before or with this phase for runtime evidence.

### Phase 2: (CONTESTED — Two Valid Strategies)

**Strategy A (FEATURES.md): Early Synthetic Fixture Enabler**  
Build fixture before hazard detection so both develop against real subject independently.  
**Rationale:** Avoids late surprises where detector validated only against itself.

**Strategy B (PITFALLS.md): Fixture Paired With Hazard Detection**  
Build fixture and detector together, cross-check against independently-sourced fixtures.  
**Rationale:** Catches "detector and fixture designed together" failure mode early.

**→ Roadmapper decision required:** Choose A (early), B (paired), or hybrid. Both grounded in incident history.

### Phase 3: Lossless-Export Invariant & Structural Guards

**Rationale:** Build exclusion mechanism and guards before extending exporter for multi-file.  
**Delivers:** `anno_excluded_range` table, structural test asserting no filter, drift guard for determinism.  
**Implements:** `BUILD-07` lossless invariant, `BUILD-05` provenance-carry (read-only).

### Phase 4: Multi-File Export + ACME Integration (`BUILD-01`, `BUILD-02`, `BUILD-03`)

**Rationale:** Lossless invariant established; extend exporter for scope-partitioned output.  
**Delivers:** Scope-splitting, `!source` wiring, universal symbolization, `cwd` fix.  
**Critical:** Add `cwd: outDirPath` to `host-tool.mts` `acme.build` spawn.

### Phase 5 (if Strategy A) or Phase 5A (if Strategy B): Hazard Detection (`BUILD-04`)

**Rationale (A):** Fixture and structure in place; build detectors. (B) Paired with fixture validation.  
**Delivers:** `anno-hazards.ts` module, four-class detection, three-valued output, cross-check against `tracer.prg`/`bank.prg`/`smc.prg`.  
**Class 1:** Reuse `scanIndirectDispatch()`. **Classes 2-4:** New detectors (SMC, page-alignment, raster-timing).

### Phase 6: Reassembly Gate (`BUILD-06`)

**Rationale:** Multi-file export and hazard detection exist; gate them together as standalone phase.  
**Delivers:** Gate script, byte-diff against `expectedBytes`, hazard report required clean/acknowledged, movement always exercised.  
**Implements:** Reuse `acme-verify.ts` oracle (never re-mint).

### Phase 7: Behavioral Equivalence & Modifiability (`EQUIV-01`..`04`)

**Rationale:** Depends on reassembly gate green and structured.  
**Delivers:** Narrowed volatile mask, per-binary checkpoints, `compare.mjs` cross-binary mode, red/green paired transcripts, modifiability through hazard-adjacent code.

---

## Research Flags

**Phases needing research during planning:**
- **Phase 5 (Hazard Detection):** No library equivalents; each detector built from first principles. **Research spike:** variant taxonomy per class before implementation.
- **Phase 2 (contested):** Fixture sequencing disagreement. **Planning task:** resolve owner's preference (Strategy A vs. B).

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Decomposition):** Proven workflows, standard annotation discipline.
- **Phase 4 (Export):** Documented ACME directives, one-line `cwd` fix, standard work.
- **Phase 6 (Gate):** Established patterns, standard gate design.
- **Phase 7 (Equivalence):** Existing tools, mechanical mode-of-use change, standard testing.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Source inspection: `anno-export-asm.ts`, `host-tool.mts`, `acme-verify.ts`. Directives verified against ACME's `docs/QuickRef.txt`, `docs/AllPOs.txt`. |
| Features | HIGH | 15 requirements in PROJECT.md; complexity grounded in actual source (e.g., `external_file` type unused, confirmed zero consumers). |
| Architecture | HIGH | Module responsibilities read directly from source. Recommendations extend existing patterns. |
| Pitfalls | HIGH | Measured failures in project history (da65 wrong binary, coverage four rounds, mid-instruction precision). Domain expertise corroborated (ACME, 6502 forums). |
| **Overall** | HIGH | No assumption-based claims. Absence findings (no prior art for hazards) from direct, repeated search across SourceGen, IDA, Ghidra, arxiv, emulator tooling. |

### Gaps to Address

1. **Phase 2 fixture sequencing:** Research provides evidence for both strategies. Owner's scheduling/risk preference determines choice.

2. **Hazard-detector precision on real cracked titles:** Research focused on synthetic fixture and small fixtures. Real titles may present variants not anticipated. Measurement against real cracked titles (`bruce_lee`, etc.) deferred to v1.x (FUT-05).

3. **Cycle-exact raster-code detection:** No static algorithm exists. Flag as caution, never guarantee. Live runs only check actual timing.

4. **Zero-page constant ordering:** Must emit declarations into file always sourced first. Phase 4 explicit handling; Phase 6 gate checks encoding lengths.

5. **Split-address table round-tripping:** Store's four split-layout types must generate paired names, move together. Phase 4 special-case split-layouts; Phase 6 gate control moves one half without other.

---

## Sources

**Primary (HIGH confidence, measured in repository):**
- `.planning/PROJECT.md`, `v0.5.0-REQUIREMENTS.md`, `ENGINEERING_RULES.md`
- `src/mcp/vice/anno-export-asm.ts`, `anno-tools.ts`, `anno-coverage.ts`, `host-tool.mts`, `acme-verify.ts`, `anno-types.ts`, `anno-store.ts`
- `src/skills/acme-build/SKILL.md`, `c64-ram-capture/scripts/compare.mjs`

**Primary (HIGH confidence, official documentation):**
- ACME 0.97 "Zem" manual: `docs/QuickRef.txt`, `docs/AllPOs.txt` (via martinpiper/ACME GitHub)
- 6502.org forums: "[solved] Symbol already defined" multi-file collision
- NESdev Wiki: RTS Trick, Jump Tables
- 6502bench SourceGen: manual on RTS-trick tagging (manual, not automatic)

**Secondary (MEDIUM confidence, domain expertise):**
- SkoolKit, Gridrunner, Iridis Alpha, splat-based decomps: universal rebuildable-source pattern
- Bumbershoot Software, Antimon: raster-stabilization technique, page-crossing timing
- Held Games: matching-decomp convention

**Tertiary (Absence findings, stated as absence not positive claim):**
- No static RTS-trick detector (SourceGen manual-tagging only)
- No static SMC verifier (academic x86 malware unpacking domain only, not transferable)
- No cross-binary equivalence framework (VICE Testbench is emulator-regression only)

---

*Research completed: 2026-09-10*  
*Committed to: .planning/research/SUMMARY.md*  
*Open decision for roadmapper: Phase 2 fixture sequencing (Strategy A: early vs. Strategy B: paired)*
