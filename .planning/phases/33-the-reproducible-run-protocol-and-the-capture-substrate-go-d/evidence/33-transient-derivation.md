# 33-transient-derivation — the transient allow-list, derived on the real release

**Owner:** plan `33-10`. **Measured:** 2026-09-02, on this host, against genuine unpatched
stock VICE 3.9 at `/usr/bin/x64sc`. **Bound by** `evidence/README.md` § *Evidence
conventions* and `evidence/SCHEMA.md` § 3 (`TRANSIENT_COUNT`, `DERIVATION`).

This is the **first time `D-22`'s committed cap of 64 has met a real frame-anchored stop on
a real cracked release**. `33-RESEARCH.md` § *Open Questions* Q4 asked exactly that, and the
two nearest measured reference points sat far apart with nothing between them.

The runs, the route and the broker narrative are in
`evidence/33-capture-pair.md`; that file is the single owner of the run identities and this
one does not restate them. The derivation is run over the **port-normalised** images from
runs 1, 2 and 3 recorded there.

`PROBE_DIR`: `/home/henrik/.cache/c64-re-tools/phase33/33-10`

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479) — tests 3113 / pass 3105 / fail 2; observed before the task-scoped broker was started, per `33-capture-pair.md` § *The observed `test:automated` baseline*

---

## The three measured reference points, for context

Stated **before** the number below, so a reader can locate the observed count between them
rather than being handed it with its interpretation already attached.

| Differing addresses | The stop that produced it | Verdict under the cap of 64 |
|---|---|---|
| **0** | frame-exact stop at the KERNAL `READY` prompt (`33-RESEARCH.md` M4; `33-03`'s pre-load anchor hits 1 / 10 / 50) | writes |
| **300** | wall-clock autostarted stop on this real cracked release (`33-RESEARCH.md` M6) | **VOID** — 4.7× the cap |
| **1242** | wall-clock `READY`-prompt stop with the determinism block fully applied | **VOID** — 19× the cap |

And the one measured *at* the boundary, which is why this derivation could have gone either
way: `33-03`'s clean sweep reached **66** differing addresses on a frame-anchored,
post-load, autostarted stop at pre-protocol jitter 4000 — **2 over the cap** — against
**48** for its own reported jitter-0/2500 pair. Its earlier, *voided* pass peaked at only
28 and supported the tidier claim that frame anchoring always fits inside the cap; that
claim is **withdrawn** and this derivation was run knowing it.

---

## Which three runs, at which jitters, and why those

The committed method needs `N >= 3` runs of the **same release** under the **same
protocol** at the **same stop**. Runs 1 and 2 are `33-capture-pair.md`'s reported pair
(pre-protocol jitter 0 ms and 2500 ms, the two the plan prescribed, in that order). A
**third real capture** was taken so the minimum is met with three real images rather than by
reusing one twice.

**The third jitter is 4000 ms, and the basis was fixed before the run.** It is the third
rung of `SCHEMA.md` § 2.2's own **pre-committed** jitter ladder (`0 / 1500 / 4000 ms`) — the
largest jitter this phase committed to, in a file frozen before any measurement existed.
Chosen for that reason and no other.

**The alternative that was available and was declined, on the record.** `33-03` measured
jitter **1200 ms** landing *identically* to jitter 0 (`LIN=154 CYC=11`, 0 differing bytes).
A third run at 1200 ms would therefore have contributed almost nothing to the pairwise union
and would have kept the total comfortably under the cap. Picking it would have been choosing
the run that keeps the derivation alive — the best-of-N move convention 5 exists to forbid —
so it was not picked. That the pre-committed 4000 ms rung is also the one `33-03` measured
*over* the cap is precisely why it cannot be avoided: an input chosen to avoid a known
overflow is not an input.

All three runs share one reproducibility key
(`1a9d294e…|c3710dd6…|4242`), which is the precondition for comparing them at all.

---

## The derivation

```
$ node src/skills/c64-ram-capture/scripts/derive-transients.mjs derive --release danish --out src/skills/c64-ram-capture/transients/danish.json /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.norm.bin /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.norm.bin /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.norm.bin
pair-j0.norm.bin  sha256 23f4fe20f45db3e55367fd8c80a26f79b0d40a0cb53635f9b2c64836bc5448f5
pair-j2500.norm.bin  sha256 c79c8ec0e8b23d22d78b5ebc0d9707ad7d8bc04bf24c0ac8c11fff74a629219d
pair-j4000.norm.bin  sha256 8673db3b5529f9a51fc051ef3a3f71a25facb8753d199650e2ae457bab6a7c5e
PAIR pair-j0.norm.bin vs pair-j2500.norm.bin: 28 differing addresses
PAIR pair-j0.norm.bin vs pair-j4000.norm.bin: 48 differing addresses
PAIR pair-j2500.norm.bin vs pair-j4000.norm.bin: 26 differing addresses
TRANSIENT_COUNT: 49
cap: 64 (committed cap 64)
wrote src/skills/c64-ram-capture/transients/danish.json: release "danish", 49 entries, 3 pairs
EXIT_STATUS=0
```

**Which images were fed in, and why the normalised ones.** The images are the
**port-normalised** ones: the shipped `vsf-slice` CLI produces the raw `C64MEM` RAM array,
and `capture-predicate.ts`'s `normalisePorts()` then overlays `$0000`/`$0001` from each
snapshot's own `dirRead`/`dataRead`. The transients README is explicit that the 6510 port
overlay is normalised **in code, once, on the snapshot route**, and that spending two of the
cap's 64 slots on those two addresses would hide a real difference behind a known one. The
same images are fed to the derivation and to the comparison, so the two cannot disagree
about what they compared. Measured here: `dirRead=47` and `dataRead=55` on all three
snapshots, so the normalisation changed nothing between the runs — but it is applied for the
reason above, not because it moved a number.

TRANSIENT_COUNT: 49

**All three pairwise comparisons were performed**, not just the adjacent ones —
`3 × 2 / 2 = 3` pairings for three images, all three printed above with their counts. The
union (49) is larger than any single pairing (48) and smaller than their sum, which is what
a union of overlapping sets looks like.

## The cap decided, and it decided *write*

49 is **at or under** the committed cap of 64, so the script wrote the artifact and exited
zero. `DERIVATION: void` is **not** written — `SCHEMA.md` § 3 declares that line as written
**only** when the union exceeded the cap, and it did not. The count is 15 under the cap.

**The cap was not touched, and could not have been.** `TRANSIENT_ALLOW_LIST_CAP = 64` is
unchanged in `capture-predicate.ts`:

```
$ cd src/mcp/vice && grep -v '^ ' capture-predicate.ts | grep -c 'TRANSIENT_ALLOW_LIST_CAP = 64'
1
```

No second anchor was tried, no `--cap` was passed, and no run was retried. `--cap` only ever
narrows in any case: the script refuses a value above the committed cap by name.

**How close this came to going the other way, stated plainly.** 48 of the 49 addresses come
from one pairing — jitter 0 against jitter 4000 — and `33-03` measured **66** for what is
nominally the same comparison on a directly-launched instance. This derivation landing at 49
rather than at 66 is not a contradiction of that measurement and must not be read as one:
the two were taken through different launch routes (`33-03` spawned `/usr/bin/x64sc`
directly; this plan acquires over the broker's control plane, whose argv additionally carries
`-remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601` and a scratch
`XDG_CONFIG_HOME`), so they are different launches with different argv digests and are not
two samples of one quantity. What both measurements agree on is the direction: **a
frame-anchored post-load stop on this release straddles the cap**, and which side it lands on
is not predictable from the protocol alone.

---

## The artifact

`src/skills/c64-ram-capture/transients/danish.json` — 49 entries, ascending by address,
`pair_count: 3`, `cap: 64`, carrying the committed method string verbatim.

```
$ node -e 'const a=require("./src/skills/c64-ram-capture/transients/danish.json");const ad=a.entries.map(e=>e.address);if(ad.length>64)process.exit(1);for(let i=1;i<ad.length;i++)if(ad[i]<=ad[i-1])process.exit(1);console.log("ARTIFACT_OK",ad.length)'
ARTIFACT_OK 49
```

It parses through the MCP-side predicate's own validator, so there is no translation step
between the derivation and the predicate:

```
$ node -e '<parseAllowList over the artifact>'
PARSED release=danish entries=49 addresses=49
ADDRESSES $00A4 $00AE $00AF $01F1 $01F2 $01F3 $13F6 $13F7 $13F8 $13F9 $13FA $13FB $13FC $13FD $13FE $13FF $1400 $1401 $1402 $1403 $1404 $1405 $1406 $1407 $1408 $1409 $140A $140B $140C $140D $140E $140F $1410 $1411 $1412 $1413 $1414 $1415 $1416 $1417 $1418 $1419 $141A $141B $141C $141D $141E $141F $1420
```

### Per-address attribution — 48 filled, 1 deliberately left empty

The union has three structural parts, and two of them are attributable from a published fact
or from a measurement recorded in this phase. The third is not, and is left blank.

| Addresses | Count | Attribution recorded | Basis |
|---|---|---|---|
| `$00AE`, `$00AF` | 2 | KERNAL load/save end-address pointer (EAL/EAH) — tracks the load in progress | the published C64 memory map; `$AE-$AF` is EAL/EAH |
| `$01F1`-`$01F3` | 3 | unused bytes in the 6502 stack page, above the live stack pointer | the address range is the stack page `$0100-$01FF` by definition |
| `$13F6`-`$1420` | 43 | the disk load's current buffer position | **measured**, `33-autostart-sequencing.md`: the contiguous run *moves with the anchor hit target* — `$0880` at hit 75, `$095D` at 100, `$0CFD` at 200, `$13F6` at 400. A load progressing at slightly different rates is exactly what that looks like |
| `$00A4` | 1 | **empty** | it sits in the KERNAL's zero-page working area, but this plan cannot name which variable **from its own evidence**, and the plan's rule is explicit: a guessed attribution is worse than a blank one, because it will be read as knowledge |

```
$ node .../attribute.cjs
ATTRIBUTIONS_FILLED 48 of 49
LEFT_EMPTY $00A4
```

**The attributions were written by hand, after the derivation, and that is by design.**
`derive-transients.mjs` cannot produce them — the README specifies `attribution` as "a
one-line attribution where known (left empty otherwise)". Re-running `derive --force`
regenerates the artifact with every `attribution` empty; the addresses, pairs and values are
untouched by the annotation step, and re-validation after it confirms the artifact still
parses and is still ascending:

```
$ node -e '<parseAllowList over the annotated artifact>'
PARSE_AFTER_ATTRIBUTION release=danish entries=49
```

### The `check` verb, round-tripped

The artifact is usable by the committed checker, not only by the deriving script:

```
$ node src/skills/c64-ram-capture/scripts/derive-transients.mjs check --allow-list src/skills/c64-ram-capture/transients/danish.json /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.norm.bin /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.norm.bin
allow-list src/skills/c64-ram-capture/transients/danish.json: release "danish", 49 addresses (cap 64)
A  pair-j0.norm.bin  sha256 23f4fe20f45db3e55367fd8c80a26f79b0d40a0cb53635f9b2c64836bc5448f5
B  pair-j2500.norm.bin  sha256 c79c8ec0e8b23d22d78b5ebc0d9707ad7d8bc04bf24c0ac8c11fff74a629219d

allowed (enumerated transients, excluded from the verdict): 28
  $00A4  $A5  ->  $10
  $00AE  $F6  ->  $0C
  $00AF  $13  ->  $14
  $01F1  $01  ->  $88
  $01F2  $A5  ->  $10
  $01F3  $A0  ->  $20
  $13F6  $00  ->  $A5
  $13F7  $00  ->  $29
  $13F8  $00  ->  $0A
  $13F9  $00  ->  $AA
  $13FA  $FF  ->  $BD
  $13FB  $FF  ->  $A8
  $13FC  $FF  ->  $4A
  $13FD  $FF  ->  $85
  $13FE  $00  ->  $06
  $13FF  $00  ->  $BD
  $1400  $00  ->  $A9
  $1401  $00  ->  $4A
  $1402  $FF  ->  $85
  $1403  $FF  ->  $07
  $1404  $FF  ->  $A0
  $1405  $FF  ->  $13
  $1406  $00  ->  $B1
  $1407  $00  ->  $06
  $1408  $00  ->  $99
  $1409  $00  ->  $53
  $140A  $FF  ->  $01
  $140B  $FF  ->  $88

DIVERGENCE -- outside the allow-list, fails at any bit count: 0

CHECK_VERDICT: equivalent
EXIT_STATUS=0
```

---

## ACCEPTED LIMIT — the list was derived from runs that include the reported pair

This is the property a reader most needs to see, and it follows from the committed method
rather than from any choice made here.

The allow-list is the union of the pairwise differences of runs 1, 2 and 3. Runs 1 and 2
**are** the pair `C0_CAPTURE_PAIR` is computed over. So the pair's 28 differing addresses are
inside the list **by construction**, and the comparison in `33-capture-pair.md` returning
`equivalent` was determined the moment the derivation wrote an artifact at all. The pair
comparison is therefore not an independent test of the pair; it is a re-statement of "the
union fitted under the cap".

That is not a defect in this measurement and it must not be repaired by inventing a
different method: `D-23` and `transients/README.md` fix the method (N ≥ 3 runs of one
release at one stop, union of every pairwise comparison, cap 64, exceeding voids), and it is
frozen. What the property means is that **the entire discriminating power of this result
sits in the cap**, exactly as the README says: "The cap does not separate 'a few transients'
from 'a lot of transients'. It separates **a frame-exact stop** from **a stop that is not**."
Read the `pass` in `33-capture-pair.md` that way and it says what it can support — the union
of this stop's run-to-run variation fits inside 64 enumerated addresses — and not what it
cannot, which is that the stop is frame-exact. `CAPTURE_FRAME_EXACT: no` is recorded beside
it and reports the opposite of what a casual reading of `pass` would suggest.

**The list is not vacuous, and that was checked rather than assumed.** A one-bit flip planted
at `$C000` — outside the 49 addresses — makes the same comparison fail:

```
$ node -e '<compareCaptures with one bit planted at $C000, outside the allow-list>'
PLANT_ADDR $C000 in_allow_list=false
PLANT_BEFORE a=$FF b=$FF
PLANT_AFTER  a=$FF b=$FE bits=1
PLANTED_COMPARE verdict=not-equivalent differing=1 allowed=28
PLANTED_DIFFERING $C000
```

49 addresses out of 65536 are allowed to differ; a single bit anywhere in the other 65487
fails. There is no bit-count tolerance at any address, including the allow-listed ones —
those are excluded from the verdict entirely, not softened.

## Voided runs

One run in this measurement produced no usable stop, and it is enumerated with its reason in
`33-capture-pair.md` § *Voided runs* (**VOIDED RUN V1** — the first `pair-j0` attempt,
`ECONNREFUSED` before the anchor was armed; no snapshot, no image, no orphan). No run was
voided during the derivation itself, and no derivation was re-run: there is exactly one
`derive` invocation in this file and its exit status is recorded.
