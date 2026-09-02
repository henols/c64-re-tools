# Per-release transient allow-lists

One committed JSON artifact per release, written by
`../scripts/derive-transients.mjs derive`. Nothing in this directory is
inherited, hand-edited or carried across releases.

**What carries forward is the method below and the script that implements it.
Never an address set.** A real release's transients are its own frame counters,
RNG state, sprite positions and music-player pointers. An allow-list borrowed
from another release cannot be distinguished afterwards from one honestly
derived, so a contaminated ledger has no cheap repair — it has to be re-derived
from fresh captures.

## The committed derivation method

Verbatim, because this is the part that is meant to survive:

- **N >= 3 runs** of the **same release** under the **same protocol** at the
  **same stop**. Three runs is already this project's documented minimum for a
  verified capture. Fewer is refused, naming the count and the minimum.
- The allow-list is the **union of addresses differing across the pairwise
  comparisons** — every pairing, which is N(N-1)/2 for N images, not just the
  adjacent ones.
- Each entry records **the address**, **which run pairs it differed in**, the
  distinct byte values seen, and **a one-line attribution where known** (left
  empty otherwise, so an unattributed transient is visibly unattributed rather
  than absent).
- It is **re-derived per release**, and **no address set is ever inherited
  between releases**. Re-deriving over an existing artifact is refused without
  an explicit `--force`.
- The list is **enumerated** — one entry per address, never a range, a span, a
  page or a region. `parseAllowList()` in
  `src/mcp/vice/capture-predicate.ts` refuses range-shaped keys by name.
- There is **no bit-count tolerance** at any address. A one-bit difference
  outside the list fails.

```bash
S=src/skills/c64-ram-capture/scripts      # from the repo root
T=src/skills/c64-ram-capture/transients

node $S/derive-transients.mjs derive --release <id> \
  --out $T/<id>.json run1.bin run2.bin run3.bin

node $S/derive-transients.mjs check --allow-list $T/<id>.json runA.bin runB.bin
```

## The artifact shape

```json
{
  "schema_version": "1.0",
  "release": "<the registry id the runs came from>",
  "derived_from": ["run1.bin", "run2.bin", "run3.bin"],
  "pair_count": 3,
  "cap": 64,
  "method": "union of addresses differing across every pairwise comparison ...",
  "entries": [
    {
      "address": 164,
      "pairs": ["run1.bin vs run2.bin", "run2.bin vs run3.bin"],
      "values": ["$11", "$22"],
      "attribution": ""
    }
  ]
}
```

`entries` is ascending by address, so the artifact is diffable and an entry's
position never depends on which pairing happened to observe it first. `address`
is an integer; `values` are the distinct bytes seen at it, in hex, across every
pairing it differed in. This is exactly the shape `parseAllowList()` accepts —
there is no translation step between the derivation and the predicate, and the
derivation's colocated test asserts the round-trip rather than assuming it.

## The cap is 64, and exceeding it VOIDS the derivation

`TRANSIENT_ALLOW_LIST_CAP = 64` in `src/mcp/vice/capture-predicate.ts` is the
one definition; the script's default cap is asserted equal to it by test.
`--cap` **only ever narrows** — a value above the committed cap is refused by
name.

**Over the cap is not "the list is a bit long".** It means **the stop is not
frame-exact**, and that is a fact the gate must hear rather than a threshold to
move. So the script exits non-zero, writes **no artifact at all** — not a
partial one and not a truncated one — and says so. A list truncated to fit the
cap would make every later comparison pass on bytes nobody vetted, which is the
one failure this rule exists to remove. Raising the cap after seeing a
derivation overflow converts a measurement into an excuse.

### What the cap actually distinguishes — four measured reference points

The cap does not separate "a few transients" from "a lot of transients". It
separates **a frame-exact stop** from **a stop that is not**. The numbers, all
measured on this host during Phase 33:

| Differing addresses | The stop that produced it | Verdict under the cap |
|---|---|---|
| **0** | frame-exact stop at the KERNAL `READY` prompt | derivation writes |
| **66** | autostarted stop, frame anchor, pre-protocol jitter 4000 ms (48 for the reported jitter-0/2500 pair) | **VOID** — 2 over |
| **300** | wall-clock autostarted stop on a real cracked release | **VOID** — 4.7× the cap |
| **1242** | wall-clock `READY`-prompt stop with the determinism block fully applied | **VOID** — 19× the cap |

Read the second row carefully: **overflow is an observed outcome, not a
hypothetical.** A frame-anchored autostarted stop has already been measured
over the cap at one jitter and under it at another. The answer to that is a
better stop, recorded with the jitter it was taken at — not a bigger cap.

The 1242 row is also the reason the seed is not the whole story: that stop had
the determinism block applied and still differed at 1242 bytes, because it was
wall-clock-anchored. The residual is what the reset protocol and the frame
anchor close, not what the seed does.

## `$0000` / `$0001` do not belong in a derived list by hand

The 6510 port overlay is normalised **in code**, once, by `normalisePorts()` on
the snapshot route. Spending two of the cap's 64 slots on those two addresses
would hide a real difference behind a known one. They can legitimately appear in
a derivation taken from un-normalised images — `derive` compares the bytes it is
given — so if you see them in an artifact, that is what it is telling you about
the images, not a rule to add.

## What this directory refuses, and why now

`.gitignore` here refuses every image byte form — flat captures, disk and tape
images, cartridges, `.vsf` snapshots, and the archives an image arrives inside —
and it was committed **before the first derivation existed**. A directory that
starts refusing images after the first capture lands has already had one
commit's worth of opportunity to leak one. JSON is deliberately not refused:
the derived allow-lists are the artifacts this directory is for.

**If you are reading this from an installed copy of the skill, that `.gitignore`
did not come with it.** npm excludes a nested `.gitignore` from a published
tarball, so the installed `transients/` directory has this README and nothing
else. Add the same refusals to your own project's ignore rules before you take
the first capture — the whole point of the timing is that it happens before,
not after.
