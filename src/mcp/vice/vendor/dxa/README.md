# vendor/dxa — dxa 0.1.5, pinned

This directory pins [dxa](https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz)
0.1.5, the symbolic 65xx disassembler this project uses as its byte-level
code/data discovery engine (`DXA-01`). It holds no dxa source: `build.bash`
downloads the upstream tarball and builds from it.

**Provenance.** The tarball is fetched from
`https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz` (37,987 bytes,
25 Mar 2022) and pinned by `dxa-0.1.5.tar.gz.sha256`
(`8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`). Every
`build.bash` run checks the tarball against the pin before it does anything
else. The build reproduces a binary whose sha256 is
`0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523`.

The tarball has no `LICENSE` or `COPYING` file. dxa's GPL-2.0-or-later
licence is recorded in `src/mcp/vice/THIRD-PARTY-NOTICES.md`, quoted from the
per-file source headers, with the full licence text.

**`build.bash` is the only supported way to get the binary.** `dxa` is never
assumed present on `$PATH`. The host-tool execution seam (`host-tool.mts`'s
`dxa.disassemble` branch) resolves it at a fixed path (`vendor/dxa/dxa`,
relative to the module) and refuses by name, naming `build.bash` as the
remedy, when that file does not exist.

```bash
bash vendor/dxa/build.bash verify   # check the tarball against the pin
bash vendor/dxa/build.bash build    # verify, then `make` and check the binary digest
```

The built `dxa` binary and every `*.o` intermediate are gitignored. They are
host-architecture-specific and reproducible on demand from the pin.
