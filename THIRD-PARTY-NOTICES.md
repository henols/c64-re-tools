# Third-Party Notices

The canonical third-party notices for this repository — for the published
`@henols/vice-mcp` package **and** for the third-party prose incorporated into
the skill playbooks under `src/skills/` (which ship in the
`@henols/c64-re-tools` package) — live at
[`src/mcp/vice/THIRD-PARTY-NOTICES.md`](src/mcp/vice/THIRD-PARTY-NOTICES.md).

Two sections there record material actually incorporated into this
repository, rather than merely relied on:

- **cc65 (zlib)** — the 6502/6510 opcode table transcribed into
  `disasm-opcodes.ts`.
- **regenerator2000 analysis procedures (`MIT OR Apache-2.0`, this project
  elects MIT)** — prose adapted into `src/skills/` playbooks at a pinned
  upstream commit. Each absorbed file also carries its own attribution header,
  which travels inside the `@henols/c64-re-tools` tarball — the only published
  package that packs the skill playbooks. `@henols/vice-mcp` packs no skill
  file; the upstream MIT permission notice is reproduced in full below, and
  again in that package's own notices document.

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

This project itself is MIT-licensed — see [`LICENSE`](LICENSE).
