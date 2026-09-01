---
title: "Own the annotation store — replace anno's state/ with our own"
trigger_condition: "Immediately — the pivot is decided. Concretely: when the ROADMAP restructure for v0.5.0 Phases 20-22 is planned."
planted_date: 2026-08-24
---

# Own the annotation store

Build the annotation store that `the external analyser`'s `state/` (5,187 lines) and
`core.rs` (3,275 lines) provide, as our own MCP surface.

**Scope:** labels, comments, per-range data typing (code / byte / word / address /
PETSCII / screencode / table), scopes, project enums, undo, persistence, plus
cross-references derived from the typed decode and search over it.

**Reuse, do not rebuild:** `disasm-opcodes.ts` / `disasm-decoder.ts` /
`disasm-renderer.ts` (2,555 lines) already decode 6502 including illegal opcodes,
with `illegal-opcode` and `acme-unassemblable` already modelled. `anno-d64.ts`
(310 lines) is standalone. `memmap.json` + `anno-regbits-gen.ts` +
`anno-enum-gen.ts` already own machine knowledge and enum generation — retarget
rather than rewrite.

**Delete on landing:** 19,181 lines of anno integration code (9,087 non-test +
9,928 test).

**Preserve two anno design details** rather than rediscovering them: the
`=*+$01` mid-instruction label idiom for SMC write-targets, and typed label
prefixes (`zpp_`/`zpa_`/`f_`/`a_`/`e_`).

**De-risking probe, if one is wanted:** Phase 21 has to build an ACME export path
regardless. Building it against our own model instead of anno's scopes proves
the exporter and the scope model for one phase's cost.

See [[dxa-ghidra-pivot]] for the full sizing table.
