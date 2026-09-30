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
| 03 | [Application API](03-application-api.md) | Deterministic C64 operations available to MCP, CLI and tests |
| 04 | [Host Runtime](04-host-runtime.md) | Host/client split, sessions, transport, tools and file staging |
| 05 | [VICE integration](05-vice-integration.md) | Emulator lifecycle and monitor abstraction |
| 06 | [Project and knowledge](06-project-knowledge.md) | Project model and the minimal SQLite knowledge database |
| 07 | [Skills and workflows](07-skills-and-workflows.md) | What belongs in skills and what must remain implementation |
| 08 | [Installation and distribution](08-installation-and-distribution.md) | Installation through existing skill/MCP package handlers |
| 09 | [Build, test and release](09-build-test-release.md) | Development, functional equivalence, CI and release principles |
| 10 | [Current-code reuse](10-current-code-reuse.md) | How the existing implementation may inform the rewrite |

## Core decisions

1. **One MCP process owns one VICE instance.** One MCP connection to the Host Runtime equals one runtime session and one emulator.
2. **One Host Runtime serves many independent MCP sessions.** It owns VICE and native host tools because those belong on the graphical host, not in each devcontainer/headless agent environment.
3. **The Host Runtime owns all VICE monitor communication.** Binary/text monitor details never cross into the Application API.
4. **Tools are deterministic operations; skills own workflows.** Skills explain when and how to combine capabilities but contain no application implementation.
5. **The project is the ordinary project directory.** No project manifest is required in v1.
6. **`.c64-re-tools/knowledge.db` is the single persistent toolkit-owned knowledge store.** There is no mirrored JSON/JSONL representation.
7. **The original C64 application remains where the developer places it inside the project.** c64-re-tools does not copy it into another registry or managed store.
8. **The supported capability set is fixed.** A missing required capability means the installation/session is broken; there is no capability negotiation mode.
9. **Functional behavior, not byte identity, defines a successful reconstruction.** Repeatable emulator tests provide evidence of equivalence.
10. **The rewrite is greenfield.** Current code is inspiration and evidence, not an API/schema compatibility target.
