# 33-04 — The `.vsf` slicer substrate, and why this file does not carry `SLICER:`

Owner: plan `33-04` (`CAP-01`). Written 2026-09-02.

This file holds **one half** of the `SLICER:` derivation — the `vsf-slice.test.ts` transcript —
and an `## ACCEPTED LIMIT` recording, by name, why the outcome line itself is **not** emitted
here. It is not a second opinion on `SLICER:` and it does not carry that line at any indentation.

Conventions per `evidence/README.md` § *Evidence conventions*, which is binding on every plan in
this phase and is cited rather than restated. `PROBE_DIR` is
`/home/henrik/.cache/c64-re-tools/phase33/33-04`; the raw captures below live there and were
copied into this document, never reconstructed from memory.

---

## ACCEPTED LIMIT — `SLICER:` is not emitted by this plan

`evidence/SCHEMA.md` § 2.4 declares `SLICER`'s derivation as:

> **`validated`** iff **both** `node --test vsf-slice.test.ts` **and** `node --test
> capture-predicate.test.ts capture-seam.test.ts` report `fail 0`, with **both transcripts
> appended to the declared source file**.

and § 2 declares its single source file as `evidence/33-slicer-validation.md`, whose owner in
`evidence/README.md`'s artifact table is plan `33-07`.

**Neither of the second suite's two files exists at this commit.** `capture-predicate.test.ts`
and `capture-seam.test.ts` are `CAP-02` deliverables, produced elsewhere in this phase. So:

- `SLICER: validated` would be **false** — half of the declared derivation has no transcript,
  and a `fail 0` claimed without its run output is what § 2.4 explicitly refuses to accept.
- `SLICER: failed` would be **wronger** — it fires `R1 → no-go` on the absence of a sibling
  plan's not-yet-written file rather than on any measured property of the slicer, which is the
  same class of error as `D-21`'s arithmetic: the gate's most easily-earned input lost to a
  bookkeeping mistake.
- Writing the line into **this** file would be a name collision, not a second opinion —
  `SCHEMA.md` § 1 states one declared source file per line and names the declared file as the
  one that counts.

**The limit, stated plainly:** this plan can produce only the first of `SLICER:`'s two required
transcripts, so the outcome line is not derivable at this commit and is left to its declared
owner. `SCHEMA.md`'s own instruction for a plan that finds a gap in the pre-commitment —
"records that as an `## ACCEPTED LIMIT` in its **own** evidence file … It does not invent a
name, and it does not edit this file" — is the route taken here. Nothing in `DECISION-RULE.md`,
`SCHEMA.md` or `README.md` was modified.

**What `33-07` must do with this file:** append its own `capture-predicate.test.ts` /
`capture-seam.test.ts` transcript to `evidence/33-slicer-validation.md`, re-run
`node --test vsf-slice.test.ts` there (a transcript is re-run at the point of derivation, not
inherited — this one is evidence that the suite was green at this commit, not a substitute for
running it again), and emit `SLICER:` in that file. The suite named below is committed and
re-runnable; nothing here needs to be taken on trust.

---

## Broker state and baseline

Recorded because this plan ran the repository's automated suite, whose baseline a live broker
falsifies deterministically (`README.md` convention 3). This plan is otherwise **emulator-free**:
it drives no emulator, opens no monitor socket and reads no corpus.

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -a -x x64sc; echo "exit=$?"
exit=1
```

`-x` (exact process name) and not `-af`: `pgrep -af x64sc` matches its **own** wrapper command
line on this host, because the pattern appears in the command being run. That false positive was
observed while taking this transcript and is recorded rather than quietly corrected — an
apparent `x64sc` hit from `-af` is not evidence of a running emulator.

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file, both in anno-register.test.ts (:385 and :479), from one root cause (the anno register cites requirement ids STORE-01, STORE-04, STORE-06 and MCP-04, which .planning/REQUIREMENTS.md does not declare) — measured identically BEFORE and AFTER this plan's three commits, so this plan introduced no failure

The before/after comparison, taken with the same command on the same tree:

```
$ cd src/mcp/vice && npm run test:automated
ℹ tests 3002
ℹ pass 2994
ℹ fail 2
ℹ skipped 1

test at anno-register.test.ts:385:1
test at anno-register.test.ts:479:1
```

The pre-change run at `HEAD = 093f11c` reported the same two failures at the same two lines.
Not "clean" and not "0 failures": the count is a recorded baseline and never a gate.

---

## `$ cd src/mcp/vice && node --test vsf-slice.test.ts`

The first of `SLICER:`'s two declared transcripts. Verbatim stdout:

```
✔ FIRST_MODULE_OFFSET is 58 -- the second magic block is accounted for (3.423721ms)
✔ MIN_C64MEM_BODY_LEN is 65543 and V01_C64MEM_BODY_LEN is 65555, and neither is 4 + 65536 (0.502723ms)
✔ MODULE_HEADER_LEN is 22 and the size field sits at header offset 18 (1.408371ms)
✔ listSnapshotModules: returns the well-formed fixture's modules in file order (2.350976ms)
✔ listSnapshotModules: the walk ends at EXACTLY the file length (0.693429ms)
✔ listSnapshotModules: every module's declared extent lies inside the file (0.884424ms)
✔ sliceC64Mem: a well-formed minor-1 snapshot yields exactly 65536 bytes of RAM (7.742137ms)
✔ sliceC64Mem: the returned image is the RAM ARRAY, not the 4-byte port prefix (1.032959ms)
✔ sliceC64Mem: dataOut/dataRead/dirRead come from the 3-byte SUFFIX after the RAM array (0.611416ms)
✔ sliceC64Mem: reports snapshotMinor 1 and bodyLength 65555 for the minor-1 fixture (0.855228ms)
✔ sliceC64Mem: the returned image is a COPY -- writing it does not touch the snapshot bytes (0.702945ms)
✔ VsfSliceError is the module's own named error type (0.445797ms)
✔ vsf-slice.ts imports nothing from this repo -- only node: builtins, and only in the CLI region (22.265638ms)
✔ vsf-slice.ts's LIBRARY region performs no filesystem, subprocess or network I/O (6.750252ms)
✔ the CLI entry point is guarded: main() is only reachable behind the entry-point check (5.788458ms)
✔ importing vsf-slice.ts runs nothing: a fresh process that only imports it exits 0 and prints nothing (174.464352ms)
✔ the CLI writes exactly 65536 bytes for a well-formed snapshot and exits 0 (194.946788ms)
✔ the CLI exits non-zero on a malformed snapshot and prints the module's OWN message, unmodified (250.344963ms)
✔ no exported function takes a filesystem path -- both take a byte array (22.509143ms)
✔ malformed module header: refuses at the offset, naming it, and says it did not rescan (5.938507ms)
✔ the refusal DISCRIMINATES: the well-formed fixture in the same test does not throw (1.166779ms)
✔ malformed module header: an implementation that rescanned would reach C64MEM -- it must not (0.74797ms)
✔ short C64MEM body: refuses naming both the observed 65542 and the minimum 65543 (5.714109ms)
✔ the body-length BOUNDARY, as a boundary: 65543 is accepted and 65542 is refused (8.826974ms)
✔ snapshot minor 0: 65536 RAM bytes, snapshotMinor 0, bodyLength 65543, suffix bytes present (1.439852ms)
✔ no C64MEM module: refuses listing the module names that WERE found (6.887994ms)
✔ a name that merely CONTAINS C64MEM does not match -- C64MEMHACKS is a real adjacent module (0.865688ms)
✔ two C64MEM modules: refuses naming the count and both offsets, never first-wins (4.222257ms)
✔ a zero-byte input is refused by name, never as a short buffer (0.719637ms)
✔ an input one byte short of a file header plus one module header is refused by name (8.172179ms)
✔ a file long enough but without the snapshot magic is refused by name (0.460758ms)
✔ a walk that does not end exactly at the file length is refused, naming both numbers (2.411417ms)
✔ every .vsf fixture has a sidecar declaring itself synthetic and naming its generator (1.74361ms)
✔ vsf-slice.ts is in package.json files[] and no fixtures entry is (2.125459ms)
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1204.905899
exit=0
```

`fail 0`, 34 tests. Raw capture at `PROBE_DIR/vsf-slice-suite.txt`.

## `$ cd src/mcp/vice && npm run typecheck`

```
> @henols/vice-mcp@0.0.0-dev typecheck
> tsc --noEmit -p tsconfig.json

exit=0
```

No line matching `error TS`. Raw capture at `PROBE_DIR/typecheck.txt`.

## `$ node --test 'src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs'`

The skill-side route. Not part of `SLICER:`'s declared derivation; recorded because the
requirement `CAP-01` is satisfied through this route and a claim about it with no transcript
behind it would be a restatement.

```
✔ slice: reaches the layout module over the in-repo rung and writes a full 64K image (374.806269ms)
✔ slice: the VICE_MCP_DIR rung resolves too, and is preferred over the in-repo path (366.166882ms)
✔ digest: prints a sha256 and the image length without writing a file (381.309244ms)
✔ no rung resolves: exits non-zero naming EVERY path tried and telling the caller to set VICE_MCP_DIR (93.473517ms)
✔ a malformed snapshot: stderr carries the layout module's OWN refusal message, unmodified (352.41513ms)
✔ an unknown verb is answered by THIS script's usage, not by a subprocess's (60.013997ms)
✔ no verb at all prints usage and exits 0 (79.083572ms)
✔ the wrapper carries no snapshot layout constant of its own (1.572968ms)
✔ the wrapper's header records the cross-package constraint and why route (b) was taken (0.663652ms)
✔ the wrapper reaches no external host binary: it spawns the running interpreter only (3.678544ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1881.685861
exit=0
```

Raw capture at `PROBE_DIR/wrapper-suite.txt`.

---

## The refusals, observed rather than asserted

Recorded here because `CAP-01`'s central acceptance criterion is that a malformed snapshot is
**refused** rather than silently returning a plausible 65536 bytes. Each row below is a
committed fixture under `src/mcp/vice/fixtures/vsf/`, each with a `"synthetic": true` provenance
sidecar naming its generator. None of these values is remembered; each is the message the code
emitted when the fixture went through it.

| Fixture | File bytes | Observed |
|---|---|---|
| `wellformed-minor1.vsf` | 65690 | slices: 65536 RAM bytes, module minor 1, body 65555, ports `data_out=39 data_read=55 dir_read=47` |
| `wellformed-minor0.vsf` | 65678 | slices: 65536 RAM bytes, module minor 0, body 65543, the 3-byte suffix present |
| `malformed-header.vsf` | 131 | refused: `malformed module header at offset 88 (name="C64MEM", major=0, minor=1, size=21) … refusing rather than rescanning` |
| `short-c64mem.vsf` | 65677 | refused: `C64MEM body is 65542 byte(s), need at least 65543 … refusing a short read` |

Verbatim, from the CLI on the malformed fixture:

```
$ node src/mcp/vice/vsf-slice.ts slice src/mcp/vice/fixtures/vsf/malformed-header.vsf --out "$D/bad.bin"
listSnapshotModules: malformed module header at offset 88 (name="C64MEM", major=0, minor=1, size=21); a module size must be at least 22 and must not run past the 131-byte file -- refusing rather than rescanning, because a byte-by-byte rescan can lock onto a false module name inside RAM data and return a garbage image.
exit=1
```

No file was written on that run — a refused slice leaves nothing behind, which the suite above
asserts by `existsSync` rather than by inspection.

Four further refusals have no fixture because they are constructed in-test from one, so the case
cannot drift from the fixture it derives from: a missing `C64MEM` (renamed in a copy), a
duplicated `C64MEM` (a second header renamed in a copy), a zero-byte input, and an input of
`FIRST_MODULE_OFFSET + MODULE_HEADER_LEN - 1` = 79 bytes.

---

## Measured facts this plan adds

Two, both incidental to `CAP-01` but load-bearing for anything that reads the returned image:

1. **`Buffer.prototype.slice` is a view, not a copy.** `readFileSync` returns a `Buffer`, whose
   `slice` overrides the `TypedArray` method as an alias for `subarray`. A slicer written as
   `bytes.slice(ramStart, ramStart + RAM_SIZE)` therefore returns a **view into the snapshot**
   for exactly the input type every real caller passes — so a caller normalising RAM
   `$0000`/`$0001` would be writing into the snapshot bytes, and the whole snapshot would stay
   alive behind a 64K image. Measured by the module's own copy-independence test, which failed
   on the first implementation. The shipped code uses `new Uint8Array(RAM_SIZE)` + `set`, with a
   length re-check ahead of it so "never `subarray` on an unvalidated length" holds by
   construction rather than by implication.

2. **The synthetic fixtures reproduce the measured header geometry byte-for-byte.** The first 64
   bytes of `wellformed-minor1.vsf` are identical to `33-RESEARCH.md` M5's hexdump of a genuine
   3.9 snapshot (magic, snapshot major/minor `02 00`, `"C64SC"` NUL-padded, the second magic
   block, `03 09 00 00`, the SVN dword, then `"MAINCPU"` beginning at 58). That is what makes a
   synthetic fixture usable as a layout regression rather than merely as a shape.
