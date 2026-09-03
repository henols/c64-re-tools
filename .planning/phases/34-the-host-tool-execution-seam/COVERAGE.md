# API Coverage — Phase 34

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

No external API integration: this phase extends this project's OWN newline-delimited-JSON
TCP control plane (`src/mcp/vice/broker-control.mts`) with one op and spawns local host
binaries (`acme`, the packer oracle, later `dxa` / Ghidra `analyzeHeadless`) as child
processes — there is no third-party API, SDK, REST/GraphQL/gRPC endpoint, OAuth flow or
webhook in scope, and `34-RESEARCH.md` § Standard Stack records that no npm/pip/cargo
package is installed by this phase either.

The deterministic detector agreed at plan time: `api-coverage.cjs --json` over the
Phase 34 ROADMAP section returned `{"detected":false,"signals":[]}`. This file exists so
that the seal-time re-scan — which reads the PLAN.md bodies as well, and those bodies
necessarily use words like "wire", "connect", "endpoint" and "MCP" about this project's
own internals — resolves against a reasoned declaration rather than a fresh guess.
