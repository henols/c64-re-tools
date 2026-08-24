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
  which travels inside the published tarball.

This project itself is MIT-licensed — see [`LICENSE`](LICENSE).
