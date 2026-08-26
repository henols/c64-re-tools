# Phase 23 — API Coverage Declaration

No external API integration: the phase ships zero product code and adds no client, SDK or
endpoint. Its three instruments are a locally-built CLI (`dxa` 0.1.5, pinned by sha256), a
locally-installed headless application (Ghidra 12.1.3), and this project's **own existing**
`vice` MCP tool surface — which is not an external API being integrated here, since the
phase adds no tool, changes no manifest, and calls only tools that already ship. The single
network operation in the whole phase is one `curl` of a source tarball over HTTPS whose hash
is verified before extraction; that is a supply-chain control, recorded as threat `T-23-SC`
in every plan's `<threat_model>`, not an API surface with a capability list to enumerate.

Deliverables are documents and evidence transcripts under
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/` plus one durable
findings document at `docs/phase23-real-release-gate-findings.md`.

*Declared: 2026-08-26, at planning time.*
