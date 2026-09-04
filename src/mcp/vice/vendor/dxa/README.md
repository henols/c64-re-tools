# vendor/dxa — dxa 0.1.5, vendored and pinned

This directory holds the **upstream-unmodified** source of
[dxa](https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz) 0.1.5, the
symbolic 65xx disassembler this project uses as its byte-level code/data
discovery engine (`DXA-01`). The 17 files here (`ChangeLog`, `dump.c`, `dxa.1`,
`INSTALL`, `label.c`, `main.c`, `Makefile`, `opcodes.h`, `options.h`,
`proto.h`, `scan.c`, `structures.h`, `table.c`, `tests/Makefile`,
`tests/test01.t`, `tests/test02.t`, `vector.c`) are exactly the tarball's
contents, unpacked with `--strip-components=1` — nothing added, nothing
removed, nothing patched.

**Provenance.** Fetched from
`https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz` (37,987 bytes,
25 Mar 2022), pinned by `dxa-0.1.5.tar.gz.sha256`
(`8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`). The pin
was written to this directory BEFORE the tarball was ever fetched, and every
`build.bash` run re-verifies the tarball against it before doing anything
else. The build reproduces a binary whose sha256 is
`0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523`.

There is no `LICENSE` or `COPYING` file in the tarball — dxa's GPL-2.0-or-later
licence is recorded in `src/mcp/vice/THIRD-PARTY-NOTICES.md`, quoted from the
per-file source headers, along with the full licence text this project
supplies because the upstream tarball ships none.

**`build.bash` — not a package manager, not `$PATH` — is the only supported
way to obtain the binary.** `dxa` is never assumed present on `$PATH`; the
host-tool execution seam (`host-tool.mts`'s `dxa.disassemble` branch) resolves
it at a fixed, computed path (`vendor/dxa/dxa`, relative to the module) and
refuses by name, naming `build.bash` as the remedy, when that file does not
exist.

```bash
bash vendor/dxa/build.bash verify   # re-verify the tarball and the committed tree
bash vendor/dxa/build.bash build    # verify, then `make` and check the binary digest
```

The built `dxa` binary and every `*.o` intermediate are gitignored
(`.gitignore`) — they are host-architecture-specific and reproducible on
demand from the pin; committing them would publish an artifact no digest gate
could then defend.

**Packaging decision (A-06): this vendored source, and the `dxa-*` modules
that consume it, are deliberately absent from `package.json`'s `files[]`.**
`scripts/check-npm-packages.mjs`'s leak checks (`node_modules/`, `*.test.*`,
`fixtures/`, `test-corpus.mjs`) do not cover `vendor/`, so no existing gate
decides this either way — this record is the only place the decision exists.
At this milestone dxa has no consumer-facing entry point (no MCP tool, no
`anno` CLI verb, no skill route) — it is a maintainer-side discovery engine
only. Shipping a module whose native dependency is deliberately not shipped
would publish a broken promise. **Reversal condition:** the phase that
registers a consumer-facing entry point for the code/data map decides
`files[]` for the whole family — the `dxa-*` modules and this vendored tree
together — in that same commit.
