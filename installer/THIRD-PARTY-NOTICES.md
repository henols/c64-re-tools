# Third-Party Notices for `@henols/c64-re-tools`

This package is MIT-licensed, copyright Henrik Olsson (see `LICENSE` at the
repository root). It ships the C64 reverse-engineering **skill playbooks**
under `skills/` plus the installer CLI under `bin/`, and it declares one
runtime dependency, `@henols/vice-mcp`, which carries its own notices file.

This document covers only the third-party material that ships **in this
package**. It is deliberately not a second, competing inventory: the canonical
third-party notices for the whole repository — including the cc65 opcode-table
transcription and the ACME/VICE/regenerator2000 not-incorporated scope notes,
none of which ship here — live in the `@henols/vice-mcp` package at
`src/mcp/vice/THIRD-PARTY-NOTICES.md` in the repository, and inside that
package's own tarball as `THIRD-PARTY-NOTICES.md`. Read that file for the full
inventory; read this one for what `@henols/c64-re-tools` itself carries.

## Incorporated material — regenerator2000 analysis procedures (MIT OR Apache-2.0)

The skill playbooks in this package incorporate prose **adapted** from
regenerator2000's own analysis procedures.

| Fact | Value |
| --- | --- |
| Source repository | <https://github.com/ricardoquesada/regenerator2000> |
| Pinned commit | `493f840418f1450a342bb220c2fe3d2585dd0525` |
| Commit date | 2026-07-11 (tag `v0.9.20`) |
| Upstream licence | `MIT OR Apache-2.0` — dual, at the user's option |
| Upstream copyright | `Copyright (c) 2026 Ricardo Quesada` |
| This project elects | **MIT** |

The five pinned upstream source files, all five of them incorporated:

- `.agent/skills/r2000-analyze-basic/SKILL.md`
- `.agent/skills/r2000-analyze-blocks/SKILL.md`
- `.agent/skills/r2000-analyze-program/SKILL.md`
- `.agent/skills/r2000-analyze-routine/SKILL.md`
- `.agent/skills/r2000-analyze-symbol/SKILL.md`

Those paths are not in the published regenerator2000 crate — its `Cargo.toml`
`exclude` list drops `.agent/**/*` — so the GitHub repository at the pinned
commit above is the only source for them.

**The incorporated text is ADAPTED, NOT VERBATIM.** It was rewritten to run
against this project's own curated tool surface: upstream's parallel
subagent fan-out is not carried, its runtime reads of its own excluded
agent-skills directory are replaced with this project's skill paths, its
cursor-based entry routes are replaced by explicit address input, and the
upstream tool steps this project does not expose are omitted or re-routed.

**The per-file attribution header is the authoritative statement, not this
document.** Every playbook in `skills/` that carries absorbed prose has an
`ATTRIBUTION (ABS-02)` block immediately after its YAML frontmatter, naming
that file's own source path, the pinned commit, the **sha256 of the upstream
bytes it was adapted from**, the licence, this project's election, and the
specific deviations made from that specific procedure. Two playbooks
incorporate two upstream procedures each, and therefore carry two blocks —
one per source path, because a single header could only claim one of the two
digests. The per-file digests are deliberately not restated here: a header
travels with the file even when a consumer copies one playbook out of this
package, which is the case this document cannot cover.

**Why MIT is elected.** MIT matches this repository's own licence, so the
incorporated prose and its host carry identical terms and a downstream
consumer inherits one set of obligations rather than two. The Apache-2.0
§4(b) modification-notice obligation is discharged either way by the
"ADAPTED, NOT VERBATIM" statement and the named deviations in every per-file
header, so the election costs nothing in disclosure. MIT's inclusion condition
is discharged by reproduction: the upstream permission notice and copyright
appear in full in the section below. This package packs the absorbed playbooks
themselves — `skills/` is in its `files[]` — so the notice and every per-file
attribution header both ship inside this tarball.

## Upstream MIT permission notice (regenerator2000)

Reproduced below, byte-for-byte, is `LICENSE-MIT` as it stands in the
regenerator2000 repository at the pinned commit
`493f840418f1450a342bb220c2fe3d2585dd0525` — 1072 bytes, sha256
`e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b`. MIT's own
condition is that this notice be included in all copies or substantial
portions of the Software, so it is reproduced here rather than described.

```text
MIT License

Copyright (c) 2026 Ricardo Quesada

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Runtime dependency

- **`@henols/vice-mcp`** — this repository's own MCP server package, MIT. Its
  own third-party notices ship inside it as `THIRD-PARTY-NOTICES.md`, and that
  file is the canonical inventory referred to at the top of this document.
