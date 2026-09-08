# fixtures/c1541 — provenance

## `synthetic.d64` (174848 bytes, 40-02)

A blank, formatted 35-track 1541 image carrying the two ALREADY-COMMITTED
`fixtures/dxa/` `.prg` fixtures, written under the CBM names `basicstub` and
`tracer`. Built ONCE, on this host, with `c1541` itself (VICE 3.10,
`/usr/local/bin/c1541`) — the mutating verbs below are used exactly once,
outside the `host_tool` seam, and no mutating tool id ships on the seam
(D-25). The exact commands, run from a scratch directory holding copies of
the two source `.prg` files:

```
c1541 -format "synthetic,00" d64 synthetic.d64
c1541 -attach synthetic.d64 -write basic-stub.prg basicstub
c1541 -attach synthetic.d64 -write tracer.prg tracer
```

Resulting directory listing (`c1541 -attach synthetic.d64 -dir`):

```
0 "synthetic       " 00 2a
1    "basicstub"        prg
1    "tracer"           prg
662 blocks free.
```

**Source `.prg` fixtures** (both already committed under `fixtures/dxa/`,
unchanged by this plan):

| CBM name | Source file | sha256 |
|---|---|---|
| `basicstub` | `fixtures/dxa/basic-stub.prg` (18 bytes) | `01b9dc6965426b4940262db29f489105d23e58933695a4e451eb5f1a30ebbde8` |
| `tracer` | `fixtures/dxa/tracer.prg` (23 bytes) | `875c96218be61538bc71cf6986e37af0e8bc7e4669c85759bb1813f4a689b8a5` |

**`synthetic.d64` itself:**

sha256: `20461fb6deb8be390c6b28aab7f94e8861ebd084e1a20760f1256eb2a1273819`

Built 2026-09-08 with `c1541 (VICE 3.10)`, `/usr/local/bin/c1541` (the fork
build resolved first on this host's `$PATH` — the same binary
`findSiblingBinary()` (`host-tool.mts`) resolves at request time, since it
walks from whichever `x64sc` `backend-detect.mts` already resolved, which on
this host is also `/usr/local/bin/x64sc`).

## The acknowledged mild circularity

`c1541` built this fixture, and `c1541.*` (the `host_tool` allowlist entries
this plan adds) is the ONLY thing that ever reads it back — so the
format-correctness claim for `synthetic.d64` ultimately rests on `c1541`
agreeing with itself: a bug shared between the write path (`-format`/
`-write`, used once here) and the read path (`-dir`/`-bam`/`-entry`/
`-chain`/`-read`, used by every `c1541.*` seam call) would not be caught by
this fixture alone. Plan 40-04's real-corpus assertion (a `.d64` this
project did not create) is the independent check that mitigates this — not
this fixture, and not this plan.

## Measured per-capability output shapes (Task 1/2, this plan)

Captured directly against `synthetic.d64` on this host, 2026-09-08 — the
literals `classifyC1541*Output()` (`host-tool.mts`) match against, and the
basis for writing those regexes against real bytes rather than
`40-RESEARCH.md`'s own first-draft illustrative patterns (per this plan's
own instruction).

**`-dir`** (stdout, captured — `c1541.dir`'s `outputs[0]`):

```
0 "synthetic       " 00 2a
1    "basicstub"        prg
1    "tracer"           prg
662 blocks free.
```

**`-bam`** (stdout, captured — `c1541.bam`'s `outputs[0]`): one allocation
row per track, digit-prefixed, each column a run of `*`/`.`, e.g.:

```
 17  **...... ........ .....
 18  **...... ........ ...
```

**`-entry basicstub`** (stdout, captured — `c1541.entry`'s `outputs[0]`)
carries the line `T/S: 17/0,  1 blocks` (note the double space before the
count — an exact byte this plan's classifier regex tolerates rather than
pins).

**`-chain basicstub`** (stdout, captured — `c1541.chain`'s `outputs[0]`) —
`(17, 0) -> 19`. A single-sector file's chain output does NOT repeat a
second `(track,sector)` tuple on the right of the arrow — the LAST hop
prints only the byte count used in the final sector, a plain integer, not a
tuple. `classifyC1541ChainOutput()` therefore matches on "at least one
`(track,sector) ->`" (a track/sector pair immediately followed by an arrow),
not on a `(t,s) -> (t,s)` PAIR on both sides — the two-block case measured
separately below shows the pair-of-tuples shape does occur once a file
spans more than one sector:

```
(17, 2) -> (17,12) -> 28
```

(measured against a two-block file written to a scratch copy of this same
image during Task 1/2 development — not committed to this fixture, since
the committed fixture's own two files are both single-sector).

**`-read basicstub out.bin`**: writes the file's raw bytes to the given
output path; `out.bin`'s sha256 is byte-identical to
`fixtures/dxa/basic-stub.prg`'s own sha256 above — this is `c1541.read`'s
round-trip acceptance criterion.

## Failure shape (no exit-status signal)

`c1541` exits `0` even when a requested image does not exist — MEASURED:
`c1541 -attach no-such-image.d64 -dir` prints `Error - Cannot open file
...` and `Error - Unknown disk type 10.  Cannot read BAM.` to its OWN
stdout and exits `0`. This is exactly why D-11 forbids consulting exit
status for pass/fail: every `classifyC1541*Output()` classifier reads the
captured text for its OWN declared success shape, and an error transcript
carries none of them (no `blocks free` trailer, no per-sector allocation
row, no `T/S:` line, no arrow pair) — so the classifier oracle, not the
exit code, is what turns this into a refusal.
