# c64-re-tools — ground-up redesign

Status: **design baseline**. This describes the next implementation of c64-re-tools. It is a greenfield architecture, not a migration plan for the current codebase.

The current repository remains valuable as evidence: it contains working VICE behavior, protocol discoveries, tool integrations, failure cases and tests. Those facts may be reused, but the new implementation is not required to preserve current module boundaries, database schema, MCP tool names, broker protocol, CLI syntax or skill internals.

## Product in one sentence

c64-re-tools is an agent-friendly Commodore 64 engineering toolkit for reverse engineering unknown applications and for developing, debugging, building and testing new C64 applications.

A reconstructed application does **not** need byte-identical machine code. Given the same relevant environment and inputs, it must exhibit the same externally observable behavior as the original application.

## Reading order

| # | Document | Purpose |
|---|---|---|
| 01 | [Requirements](01-requirements.md) | Product goals, requirements, invariants and non-goals |
| 02 | [Architecture](02-architecture.md) | System boundaries, ownership and dependency direction |
| 03 | [Application API](03-application-api.md) | Stateful VICE MCP plus skill-script/local knowledge interfaces |
| 04 | [Host Runtime](04-host-runtime.md) | Host/client split, sessions, native tools and file staging |
| 05 | [VICE integration](05-vice-integration.md) | Emulator lifecycle and monitor abstraction |
| 06 | [Project and knowledge](06-project-knowledge.md) | Project model and the versioned SQLite knowledge database |
| 07 | [Skills and workflows](07-skills-and-workflows.md) | Common skill structure, execution paths and workflow rules |
| 08 | [Installation and distribution](08-installation-and-distribution.md) | Portable Agent Plugins foundation with AP SDK at the distribution edge |
| 09 | [Build, test and release](09-build-test-release.md) | Development, functional equivalence, CI and release principles |
| 10 | [Current-code reuse](10-current-code-reuse.md) | How the existing implementation may inform the rewrite |
| 11 | [Skill contracts](11-skill-contracts.md) | Exact purpose, inputs, workflow, persistence, completion and handoff contract for every first-class skill |
| 12 | [Static analysis and knowledge import](12-static-analysis-knowledge-import.md) | Normalized analyzer findings, atomic import, authoritative coverage and stale-fact reconciliation |
| 13 | [Testing and functional equivalence](13-testing-and-functional-equivalence.md) | Routine, semantic-state, visual/gameplay and human verification of reconstructed behavior |
| 14 | [VICE MCP surface](14-vice-mcp-surface.md) | Public stateful C64/VICE tool surface, machine profiles, drive8 access, visual baselines and atomic observations |
| 15 | [VICE MCP schemas](15-vice-mcp-schemas.md) | Frozen v1 addresses, conditions, tool actions, bounds and input/output result shapes |
| 16 | [Host Runtime native-tool contracts](16-host-runtime-tool-contracts.md) | Frozen v1 skill-side contracts for ACME, DXA, Ghidra, c1541 and petcat |
| 17 | [Project root and local state](17-project-root-and-local-state.md) | Deterministic manifest-free project discovery and minimal project-local state ownership |

## Core decisions

1. **One MCP process owns one VICE instance.** One MCP connection to the Host Runtime equals one runtime session and one emulator.
2. **MCP is VICE-only.** Non-VICE host tools are invoked by skill scripts through short-lived Host Runtime requests; project knowledge stays local.
3. **One Host Runtime serves many independent MCP sessions plus independent native-tool requests.** It owns VICE and native host tools because those belong on the graphical host, not in each devcontainer/headless agent environment.
4. **The Host Runtime owns all VICE monitor communication.** Binary/text monitor details never cross into the LLM-facing API.
5. **Skills own workflow; shared deterministic code owns mechanics.** Skills may contain thin scripts, but broker transport, staging, database mechanics and native-tool implementations remain shared infrastructure.
6. **All skills follow one common behavioral model.** They define purpose, inputs, execution path, workflow, knowledge policy, result, conflict/failure behavior and handoffs.
7. **Only actionable information reaches the LLM.** Infrastructure versions, protocol details, paths, request IDs and similar details stay internal unless a human explicitly requests diagnostics.
8. **The project is the ordinary project directory.** No project manifest is required in v1.
9. **`.c64-re-tools/knowledge.db` is the single persistent toolkit-owned knowledge store.** There is no mirrored JSON/JSONL representation.
10. **Knowledge history lives in the database.** Accepted knowledge changes create revisions; prior values remain reviewable and queryable rather than relying on Git history.
11. **Analyzer imports are deterministic, historical and coverage-aware.** DXA/Ghidra findings may be imported automatically through the local knowledge layer; later authoritative re-analysis can retire that analyzer's stale findings inside declared coverage while preserving history and protecting semantic LLM/user knowledge.
12. **Packaging is portable and replaceable.** Agent Plugins provides the portable foundation; `@jalco/ap-sdk` is the preferred cross-harness packaging/install adapter and remains isolated to the distribution edge.
13. **The original C64 application remains where the developer places it inside the project.** c64-re-tools does not copy it into another registry or managed store.
14. **The supported capability set is fixed.** A missing required capability means the installation/session is broken; there is no capability negotiation mode.
15. **Functional behavior, not byte identity, defines a successful reconstruction.** Evidence is layered: routine/state checks, checkpointed visual/gameplay scenarios, then human playtesting. Automated tests return PASS, FAIL or INCONCLUSIVE and never claim more equivalence than the exercised scenarios establish.
16. **The VICE MCP is a compact C64-domain interface.** Sessions have a fixed PAL/NTSC profile, support c64 and drive8 debugging spaces, keep project symbols outside the MCP, and provide temporary visual baselines plus atomic observations for testing.
17. **The v1 VICE MCP schema is frozen.** Addresses are canonical hex strings, conditions are typed rather than monitor expressions, read-only observations preserve run state, mutation/execution behavior is explicit, and the public tool list is fixed in the schema chapter.
18. **Native host tools use typed skill-side facades.** ACME, DXA, Ghidra, c1541 and petcat accept domain inputs and return structured results; file staging, argv construction, tool paths, temporary files and large-result transfer remain private runtime details.
19. **Project discovery is shared and harness-independent.** Explicit c64-re-tools root overrides win; otherwise the nearest `.c64-re-tools` or `.git` boundary is used from the working directory, with no package-location fallback. Only durable knowledge is persisted under `.c64-re-tools`; runtime/session/tool scratch stays outside the project.
20. **The rewrite is greenfield.** Current code is inspiration and evidence, not an API/schema compatibility target.
