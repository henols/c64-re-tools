# API Coverage — Phase 36

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

No external API integration: this phase adds a locally installed Ghidra distribution reached as
a declared host prerequisite through this project's own host-tool execution seam
(`src/mcp/vice/host-tool.mts`, extended here with a sixth `HostToolId` member,
`ghidra.installExtension`), plus a vendored SLEIGH language-extension source tree this project
compiles with Ghidra's own `support/sleigh` -- there is no third-party API, SDK,
REST/GraphQL/gRPC endpoint, OAuth flow or webhook anywhere in scope, and no npm, PyPI or crates
dependency is introduced by this plan (`T-36-SC` in every plan's `<threat_model>` records this
explicitly: Ghidra is a host prerequisite identified by version and sha256, not a
package-manager install, so the Package Legitimacy Gate protocol does not apply here).

The deterministic detector agreed at plan time (`36-01-PLAN.md`'s own `<flagged_assumptions>`
account) returned `detected: false` for this phase's scope at the `api-coverage.cjs` probe. This
file exists so that the seal-time re-scan -- which reads the PLAN.md bodies as well, and those
bodies necessarily use words like "seam", "wire", "connect" and "MCP" about this project's own
internals, plus "processor"/"language" about a SLEIGH compiler, not an external API -- resolves
against a reasoned declaration rather than a fresh guess. Same rationale as the Phase 34 and
Phase 35 files this one mirrors.

## Supply-chain note (not an API surface)

Ghidra itself is the one external prerequisite this phase's host tools reach: `support/sleigh`
(compiling the vendored `.sinc`/`.slaspec` source into a `.sla`) and `support/analyzeHeadless`
(running the compiled language against an imported image). Neither is fetched by this phase --
both are resolved from `$GHIDRA_HOME`, a host-side environment variable naming an already-
installed Ghidra distribution the developer provisions themselves, exactly as `GHID-*`'s own
Phase 34 host-tool-seam plans already established for `ghidra.analyze`. This phase adds no new
network call, no new fetch, and no new pinned tarball digest -- it is covered as threat
`T-36-05` ("Writing into the externally-managed `$GHIDRA_HOME` tree") in every plan's
`<threat_model>`, which is the right instrument for it, not an API-coverage row.
