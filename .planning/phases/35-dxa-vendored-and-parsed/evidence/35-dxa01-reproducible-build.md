# DXA-01 reproducible build (Phase 35, plan 35-05, Task 2)

**What this record is:** the reproducible-build claim `DXA-01`'s amended text requires, recorded
as four digests and two stated digest equalities -- never as "the build succeeded" or an exit
code. `build.bash`'s own header states the discipline this record transcribes: neither `verify`
nor `build` decides pass/fail from a spawned command's exit status alone where a digest is
available; `sha256sum`'s own exit code is read only as a companion to printing the two digests
being compared, never as the sole signal.

## The four digests, and which pin each was compared against

| # | Digest | What it is | Compared against |
|---|---|---|---|
| 1 | `8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799` | The tarball digest, as fetched/re-materialised this session | #2 (the committed pin) |
| 2 | `8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799` | The pin committed at `src/mcp/vice/vendor/dxa/dxa-0.1.5.tar.gz.sha256`, written before any fetch (Phase 23 originally, re-verified unchanged this session) | #1 |
| 3 | `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` | The built binary's digest, produced by `make` in a scratch extraction this session | #4 (the pinned build digest) |
| 4 | `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` | The pinned build digest, hardcoded in `build.bash` (`BUILT_BINARY_SHA256`) | #3 |

**Both comparisons are digest equalities, stated explicitly:** digest #1 (fetched tarball) equals
digest #2 (committed pin) exactly, and digest #3 (this session's built binary) equals digest #4
(the pinned build target) exactly. Neither `verify` nor `build` ever asked "did `curl`/`tar`/
`make` exit zero?" as its pass/fail signal where a digest comparison was available -- `set -euo
pipefail` means a genuinely failed spawned command would abort the script outright (an exit-status
failure, not a false pass), but that is a different property from the digest gate itself, which is
what actually decides whether the CONTENT is right.

## Transcript: `verify`, from this session, this host

```
$ bash vendor/dxa/build.bash verify
build.bash: pin digest      = 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799
build.bash: tarball digest  = 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799
build.bash: extracted tree is byte-identical to the committed vendor/dxa/ source
build.bash: verify OK
[exit 0]
```

The cached tarball at `~/.cache/c64-re-tools/phase23/dxa-0.1.5.tar.gz` already matched the pin
byte-for-byte, so `verify` reused it rather than re-fetching over the network (`build.bash`'s own
documented cache-reuse path: a cached copy is reused ONLY when its digest already matches the
pin, never trusted on its mere presence).

## Transcript: `build`, from this session, this host

```
$ bash vendor/dxa/build.bash build
build.bash: pin digest      = 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799
build.bash: tarball digest  = 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799
build.bash: extracted tree is byte-identical to the committed vendor/dxa/ source
gcc -Wall -Wmissing-prototypes -O2   -c -o scan.o scan.c
gcc -Wall -Wmissing-prototypes -O2   -c -o vector.o vector.c
gcc -Wall -Wmissing-prototypes -O2   -c -o dump.o dump.c
gcc -Wall -Wmissing-prototypes -O2   -c -o table.o table.c
gcc -Wall -Wmissing-prototypes -O2   -c -o label.o label.c
gcc -Wall -Wmissing-prototypes -O2   -c -o main.o main.c
gcc  -o dxa scan.o vector.o dump.o table.o label.o main.o
build.bash: pinned binary digest = 0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523
build.bash: built binary digest  = 0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523
build.bash: build OK -- .../src/mcp/vice/vendor/dxa/dxa
[exit 0]
```

`build` compiles inside a `mktemp -d` scratch extraction, never the committed tree (the committed
tree is read-only to this script) -- the produced binary is copied to `vendor/dxa/dxa` only after
its digest already matched the pin, never before.

## The pin-precedes-fetch ordering, shown rather than claimed

`verify` re-run against a COPY of the tree with the pin file (`dxa-0.1.5.tar.gz.sha256`) removed:

```
$ cp -r vendor/dxa /tmp/scratch/dxa-copy && rm -f /tmp/scratch/dxa-copy/dxa-0.1.5.tar.gz.sha256 /tmp/scratch/dxa-copy/dxa
$ bash /tmp/scratch/dxa-copy/build.bash verify
build.bash: refusing -- pin file missing: /tmp/scratch/dxa-copy/dxa-0.1.5.tar.gz.sha256
build.bash: no fetch was attempted; commit the pin before running this script
[exit 1]
```

No `curl` line appears in this transcript, no network request was made, and the script exits
before reaching the tarball-materialisation block at all -- confirming, as an OBSERVED property
of a real run rather than an inference from reading the script's source, that "the digest gate is
written BEFORE the fetch" describes what the script actually DOES on a pin-absent tree, not merely
where a line sits in the file.

## Toolchain and host

| Field | Value |
|---|---|
| `gcc` version | `gcc (Debian 14.2.0-19) 14.2.0` |
| `make` version | `GNU Make 4.4.1` |
| Host platform | `Linux ho-laptop 6.12.107+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.12.107-1 (2026-08-29) x86_64 GNU/Linux` |
| Date | `2026-09-04` |

The pinned binary digest (`0e2bf1a5…c8523`) is this project's reproducibility target on THIS
toolchain and THIS host platform specifically -- a compiled binary's sha256 is architecture- and
toolchain-specific by nature (compiler version, optimisation flags, libc, CPU target all leave
bytes in the output). A future reader who builds on a different `gcc`/`libc`/architecture and gets
a DIFFERENT digest has not found a broken build; that divergence is a fact worth recording, not a
failure to paper over, and this record exists precisely so that divergence is legible against a
known toolchain/digest pairing rather than an unexplained mismatch.

## Licence position, observed rather than assumed

Confirmed directly from the extracted tarball, this session:

```
$ ls vendor/dxa | grep -iE "licen|copying"
(no output -- no LICENSE or COPYING file present)
```

GPL-2.0-or-later appears ONLY in per-file `.c` source headers, under two-party copyright, with no
upstream signature or standalone licence grant file anywhere in the tarball. The per-file
copyright line VARIES by filename -- not a uniform block copy-pasted across every file:

| File | Copyright header |
|---|---|
| `table.c`, `vector.c` | `Copyright (C) 1993, 1994 Marko M\"akel\"a` only |
| `scan.c`, `label.c` | `Copyright (C) 1993, 1994 Marko M\"akel\"a` **plus** `Copyright (C) 2019 Cameron Kaiser` |
| `main.c`, `dump.c` | `Based on d65 Copyright (C) 1993, 1994 Marko M\"akel\"a` plus a differently-worded `Changes for dxa (C) ...-2019 Cameron Kaiser` line (the exact year range differs again between these two files) |

`src/mcp/vice/THIRD-PARTY-NOTICES.md`'s own "Incorporated material -- dxa (GPL-2.0-or-later)"
section (landed by plan 35-01) already records this per-file variance in full, quotes `main.c`'s
header verbatim, states the absent `LICENSE`/`COPYING` file explicitly, and supplies the complete
GPL-2.0 licence text the tarball itself does not ship. This record cross-references that section
rather than restating its full content a second time.

## The one corroboration that exists

`dxa` publishes no signature and no checksum of its own -- the distribution directory at
`https://www.floodgap.com/retrotech/xa/dists/` offers the tarball alone (Phase 23's own
`instrument-provenance.txt` recorded this directly: `ls -a` against the tarball's extracted
contents and the upstream directory listing turned up no `.sig`/`.asc`/`.sha`/`.md5`/`.sum` file
anywhere). The ONLY independent confirmation of the tarball's sha256
(`8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`) is the FreeBSD ports
`devel/dxa65` distinfo, which records the identical digest for the identical upstream URL --
cross-checked once, during Phase 23's own research (`23-RESEARCH.md`'s Package Legitimacy Audit,
verdict **OK**, no `[ASSUMED]`/`[SUS]`/`[SLOP]`). That is ONE corroboration from ONE independent
third party, stated plainly here as exactly that -- **it is not a cryptographic signature**, and
it does not make the pin self-authenticating; it is the single external data point this project
has ever had for this artefact, recorded honestly as such rather than inflated into more
assurance than it provides.
