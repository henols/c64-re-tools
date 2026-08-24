---
phase: 19
slug: absorbed-procedures-and-the-coverage-instrument
date: 2026-08-24
status: complete
upstream_pin: 493f840
upstream_version: 0.9.20
---

# Phase 19 Research

## Facts Established

- The upstream release `v0.9.20` is pinned to commit `493f840` (2026-07-11). It is the installed `regenerator2000 0.9.20` version.
- Upstream is dual licensed `MIT OR Apache-2.0`; this repository currently ships no upstream source, but absorbed procedure prose must add per-file attribution and a notice entry.
- The installed `regenerator2000-core-0.9.20/src/packer_signatures.rs` exposes `detect_packer(mem, load_addr, load_end) -> Option<PackerInfo>`. Supported signatures include Exomizer variants, PUCrunch, Time Cruncher, Dali, ByteBoozer, TinyCrunch, Cruel Cruncher, TBC Multicompactor, and ECA Compactor. It is internal Rust API, not a confirmed MCP read-only tool.
- Phase 18 delivers a 19-tool curated R2000 surface and a coarse FIFO session mutex. Absorbed procedures must sequence mutations; read-only fan-out may be concurrent only if a Phase 19 measurement proves stdio multiplexing.
- Existing shipped skills are six directories under `src/skills/`, installed by `scripts/sync-skills.mjs`; package validation checks their copied payload. New skill content must be authored under `src/skills`, not `.agent/skills`.

## Planning Decisions

1. Snapshot the exact five upstream analysis procedures from `493f840` into attributed project-owned skill/reference material. A manifest must name every source path, pin, extracted tool call, curated-surface disposition, and drift re-sync trigger.
2. Keep prose adaptation separate from copied Rust or procedure implementation: no upstream source files, packer signatures, or `.agent/skills` runtime dependencies enter published payloads.
3. Expose packer identity through a project-owned recon finding. First prove whether the existing MCP/CLI surface can obtain it; if not, add a narrowly scoped read-only bridge backed by live probing and report `unknown` rather than guessing.
4. Implement coverage as a project-owned CLI/report over R2000 project facts. Report three independent measures: annotation-store structural classification, Auto/User label ratio, and reproducibility sample result. Never emit one aggregate score.
5. Design non-vacuity tests first: all-auto labels, generic comments, and multi-caller labels without cross-reference evidence must each fail the corresponding measure.

## Validation Architecture

| Requirement | Evidence |
|---|---|
| ABS-01 / ABS-02 / ABS-04 | Source manifest and attribution/notice tests pin upstream paths, commit, tool diff, no `.agent/skills` references, and resync trigger. |
| ABS-03 | Inventory-wide pairwise description checker with deliberate collision fixture. |
| SURF-03 | Live-gated packer finding test against known fixture or an explicit unknown result with source evidence. |
| COV-01 / COV-02 | Unit tests over synthetic project records plus live test against a previously unseen fixture; assert separate fields and negative controls. |

## Risks

- The five upstream procedure paths and exact tool names must be fetched from the pinned source before copying. Do not infer them from release prose.
- `detect_packer()` being internal means a new MCP tool may be required; the plan must keep it read-only and explicitly test its live schema.
- Description collision detection needs normalized-token rules and an allowlist with documented rationale to avoid both silent ambiguity and noisy false positives.
