# API Coverage — Phase 35

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

No external API integration: this phase vendors a third-party C source tarball fetched once
over HTTPS against a digest pinned before the fetch, builds it with `make`, spawns the
resulting local binary as a child process through this project's OWN host-tool execution
seam (`src/mcp/vice/host-tool.mts`, extended here with a fifth `HostToolId` member), and
parses that binary's human-readable stdout with a parser this project owns — there is no
third-party API, SDK, REST/GraphQL/gRPC endpoint, OAuth flow or webhook anywhere in scope,
and `35-RESEARCH.md` § Package Legitimacy Audit records that no npm, PyPI or crates
dependency is introduced by this phase either.

The deterministic detector agreed at plan time: `api-coverage.cjs --json` over the Phase 35
scope returned `{"detected":false,"signals":[]}`. This file exists so that the seal-time
re-scan — which reads the PLAN.md bodies as well, and those bodies necessarily use words
like "wire", "connect", "endpoint" and "MCP" about this project's own internals — resolves
against a reasoned declaration rather than a fresh guess. Same rationale as the Phase 34
file it mirrors.

## Supply-chain note (not an API surface)

The one external network interaction this phase makes is a single HTTPS `GET` of
`https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz`, gated by a sha256 committed
before the fetch and re-verified byte-for-byte. That is a pinned artifact download, not an
API integration: there is no request shape to enumerate, no capability surface to subtract
from, and nothing to opt out of. It is covered as threat `T-35-SC` in every plan's
`<threat_model>`, which is the right instrument for it.
