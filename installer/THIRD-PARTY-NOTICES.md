# Third-Party Notices for `@henols/c64-re-tools`

This package is MIT-licensed, copyright Henrik Olsson (see `LICENSE` at the
repository root). It ships the C64 reverse-engineering **skill playbooks**
under `skills/` plus the installer CLI under `bin/`, and it declares one
runtime dependency, `@henols/vice-mcp`, which carries its own notices file.

This document covers only the third-party material that ships **in this
package**. It is deliberately not a second, competing inventory: the canonical
third-party notices for the whole repository — including the cc65 opcode-table
transcription and the ACME/VICE not-incorporated scope notes, none of which
ship here — live in the `@henols/vice-mcp` package at
`src/mcp/vice/THIRD-PARTY-NOTICES.md` in the repository, and inside that
package's own tarball as `THIRD-PARTY-NOTICES.md`. Read that file for the full
inventory; read this one for what `@henols/c64-re-tools` itself carries.

## Incorporated material

None. The skill playbooks under `skills/` are this project's own prose,
written against this project's own curated tool surface.

## Runtime dependency

- **`@henols/vice-mcp`** — this repository's own MCP server package, MIT. Its
  own third-party notices ship inside it as `THIRD-PARTY-NOTICES.md`, and that
  file is the canonical inventory referred to at the top of this document.
