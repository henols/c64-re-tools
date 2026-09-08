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

## `not-a-disk.d64` (36 bytes, 40-04, D-12)

The planted-failure fixture for `PREP-04`'s six per-tool non-vacuous
controls (`host-tool-oracle.test.ts`). Plain ASCII text, deterministically
authored (a fixed string, never random bytes), named with the disk-image
extension but carrying no disk-image structure at all:

```
$ printf 'This is not a valid C64 disk image.\n' > not-a-disk.d64
```

sha256: `30dffc7e21a2e7c8a962356114fde605bb36dea37a7940aafecfc875ea459981`

**MEASURED live 2026-09-08, both installed builds** (`/usr/bin/c1541`
VICE 3.9 stock, `/usr/local/bin/c1541` VICE 3.10 fork — the fork is the one
`findSiblingBinary()` actually resolves on this host, since
`backend-detect.mts` resolves the fork's `x64sc` first):

- `-attach not-a-disk.d64 -dir` and `-attach not-a-disk.d64 -entry <name>`
  both print `cannot open file ...` / `OPENCBM: opening dynamic library
  libopencbm.so failed!` / `Error - Import GCR: Unknown GCR image version
  110.` / `Unknown disk image ...` and **exit 0** on BOTH builds — a
  genuinely non-vacuous planted failure for `c1541.dir`/`c1541.entry`
  against the REAL binary: a naive exit-status check would (wrongly) pass
  this, while the classifier correctly refuses (no `blocks free` trailer,
  no `T/S:` line).
- `-attach not-a-disk.d64 -bam`, `-chain <name>` and `-read <name> <out>`
  all **exit 1** on the fork build (a distinct `illegal value` / `error:
  cannot read` internal path, not the same "cannot open" path `-dir`/
  `-entry` take) — this makes a naive exit-status check ALSO refuse, an
  AGREEING pair, which would be a vacuous control if this fixture were run
  against the real binary for those three ids. The same nonexistent-path
  input produces the identical split (0/0/1/1/1 across dir/entry/bam/chain/
  read). On the STOCK build, `-entry`/`-chain`/`-read` against this fixture
  additionally **SEGFAULT** (exit 139) — a real, separate crash this plan
  does not fix and which the shipped seam never reaches in practice (it only
  ever resolves the sibling of whichever `x64sc` is ALREADY resolved, the
  fork build on every host measured this session).
- Because of this split, `host-tool-oracle.test.ts`'s six two-directional
  controls run against a FAKE, controllable stand-in for ALL SIX tool ids
  (never the real binary) reproducing the "exit 0, declared shape absent"
  text this file documents above for `-dir`/`-entry` — the general shape
  `c1541`'s own header comment in `host-tool.mts` states for "c1541's own
  exit status ... 0 even on a genuine failure", and the one a different
  VICE build could realise for `-bam`/`-chain`/`-read` too. The real,
  installed binary's own split exit codes are recorded here as the honest,
  measured record of what THIS host's build actually does today.

## `synthetic-corrupt.d64` (174848 bytes, 40-04, D-06)

A byte-patched copy of `synthetic.d64` (identical sha256-verifiable base,
patched in exactly two places), authored for the `c64-disk-access` skill's
`audit` subcommand — the ported fakery detector's own corrupt-fixture
control. Byte offsets computed against this project's own standard 1541
zone table (`sectorsPerTrack()`; tracks 1-17 have 21 sectors each, so the
directory sector at track 18 sector 1 starts at byte `17*21*256 + 256 =
91648`):

1. **Out-of-geometry first track/sector.** The `tracer` entry (directory
   slot index 1, entry-relative offset 3 within the sector — i.e. absolute
   byte `91648 + 32 + 3 = 91683`) has its own first-track byte changed from
   `17` (0x11) to `40` (0x28) — a track that does not exist on a 35-track
   image. Sector left at `1`. Triggers signature 2 (`D-06`).
2. **Self-referential directory chain.** The directory sector's own
   "next directory T/S" header (the FIRST TWO BYTES of the sector, absolute
   offset `91648`/`91649`, shared by every entry that sector holds — see
   `c1541.mjs`'s own `parseEntryFields()` comment) changed from `00 FF`
   (end-of-chain) to `18 01` — pointing back at the sector itself. Triggers
   the chain guard.

sha256: `e95666c6288e849abb3b3def1b7959d6efdecaf57a8d1b8bd3f6422fb7571a2e`

**MEASURED live 2026-09-08** (`/usr/local/bin/c1541`, VICE 3.10): `-dir` and
`-bam` both still succeed normally (block counts and the allocation grid are
unaffected by either patch — the corruption is only in the directory
entry's own claimed fields, not in the BAM or the block-count field).
`-entry basicstub` succeeds and reports the corrupted `Next directory T/S:
18/1` header. `-entry tracer` FAILS OUTRIGHT — `c1541` itself tries to read
track 40 sector 1 as part of resolving the entry and errors `Error - Error
reading T:40 S:1 from disk image.` (exit 0) BEFORE ever printing a `T/S:`
line, so the seam's own `classifyC1541EntryOutput()` refuses this call
exactly as it would any other declared-shape-absent output — no separate
error path was needed. The `audit` subcommand salvages the claimed track/
sector out of that refusal message's own text (`salvageFirstTsFromRefusal()`
in `c1541.mjs`) rather than losing the information the moment the entry
call itself fails.

## The real-corpus mitigation (40-04, Task 3, D-25)

`synthetic.d64` and `synthetic-corrupt.d64` were BOTH built by the very
`c1541` binary this project's `c1541.*` seam calls read back — the
"acknowledged mild circularity" section above names the resulting risk.
The mitigation lives in `src/skills/c64-disk-access/scripts/c1541.test.mjs`,
as ONE live-gated test case cross-validating the directory listing, one
entry's own claimed first track/sector, and that same entry's independently
walked sector chain against each other, run against Phase 23's own evidence
corpus image (`.planning/phases/23-the-real-release-gate-go-degrade-no-go/
evidence/corpus/danish.d64`) — a real release this project did not create
and never copies into this `fixtures/` tree. The case is gated on that
corpus image's own presence on disk and SKIPS (never fails) when it is
absent, so a checkout without the evidence tree stays green.
