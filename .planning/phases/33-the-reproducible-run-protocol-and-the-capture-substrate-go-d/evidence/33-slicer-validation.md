# 33-07 — The `SLICER` gate input: the slicer suite and the predicate/seam suite

Owner: plan `33-07` (`CAP-02`, `CAP-03`, `REPRO-03`). Declared source file for the `SLICER`
gate input per `evidence/SCHEMA.md` § 2 and § 2.4. Written 2026-09-02.

Conventions per `evidence/README.md` § *Evidence conventions*, which is binding on every plan
in this phase and is cited rather than restated. `PROBE_DIR` is
`/home/henrik/.cache/c64-re-tools/phase33/33-07`; every transcript below was captured there
first and copied in verbatim, never reconstructed from memory.

This plan is **emulator-free**: it drives no emulator, opens no monitor socket and reads no
corpus. The broker state and baseline are recorded anyway, because the conventions are binding
on every plan in the phase and a reader comparing transcripts should not have to work out which
ones carry the header.

---

## What `SCHEMA.md` § 2.4 declares, and what it therefore takes to close this line

> **`validated`** iff **both** `node --test vsf-slice.test.ts` **and** `node --test
> capture-predicate.test.ts capture-seam.test.ts` report `fail 0`, with **both transcripts
> appended to the declared source file**.
>
> **`failed`** otherwise.

Two suites, both named individually, both transcripts required in THIS file. Plan `33-04` could
produce only the first of them -- `capture-predicate.test.ts` and `capture-seam.test.ts` are
`CAP-02`/`CAP-03` deliverables that did not exist at its commit -- and it recorded that as an
`## ACCEPTED LIMIT` in `evidence/33-04-slicer-substrate.md` rather than emitting a line it could
not derive. That limit is closed here, by this plan, in this file.

**`vsf-slice.test.ts` is RE-RUN below rather than inherited from `33-04`'s transcript.** A
transcript is evidence that a suite was green at the commit it was taken on; it is not a
substitute for running the suite at the point of derivation. `33-04`'s copy stands as its own
record and this one is the derivation's.

**Scope note on the whole-repository baseline.** `SLICER`'s condition is `fail 0` on the two
**named suites**, and on nothing else. The repository's `test:automated` gate carries a
pre-existing red baseline of **2 failing tests in 1 file** from a root cause this phase did not
create, recorded below per convention 4. That baseline is **outside** § 2.4's stated condition
and does not drag `SLICER` to `failed` -- stating it explicitly because the two numbers sit on
the same page and a later reader must not fuse them.

---

## Broker state and baseline

$ systemctl --user is-active vice-broker

```
inactive
exit=4
```

`exit=4` and not `3`: on this host there is no `vice-broker` user unit loaded at all, which is a
stronger form of "not running" than a loaded-but-stopped unit. Recorded as observed rather than
smoothed to match a sibling transcript.

$ pgrep -a -x x64sc; echo "exit=$?"

```
exit=1
```

`-x` (exact process name) and **not** `-af`: `pgrep -af x64sc` matches its **own** wrapper
command line on this host, because the pattern appears in the command being run. `33-04`
observed that false positive and recorded it; it is repeated here rather than re-discovered.
No output plus `exit=1` is the no-emulator observation.

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file, both in anno-register.test.ts (:385 and :479), from one root cause this phase did not create (the anno register cites requirement ids STORE-01, STORE-04, STORE-06 and MCP-04, which .planning/REQUIREMENTS.md does not declare) -- observed AFTER this plan's three commits at 3088 tests / 3080 pass / 2 fail, against the 3049/3041/2 measured after 33-06, so this plan added 39 tests and no failure

$ cd src/mcp/vice && npm run test:automated

Summary lines and the two failing-test locations, verbatim (the full 3088-test transcript is at
`PROBE_DIR/test-automated.txt`):

```
ℹ tests 3088
ℹ suites 24
ℹ pass 3080
ℹ fail 2
ℹ skipped 1
test at anno-register.test.ts:385:1
test at anno-register.test.ts:479:1
exit=1
```

Not "clean" and not "0 failures": the count is a recorded baseline and never a gate
(`DECISION-RULE.md` § *Never a gate*). `exit=1` is the two known failures and nothing else.

---

## `$ cd src/mcp/vice && node --test vsf-slice.test.ts`

The first of `SLICER:`'s two declared transcripts, re-run at the point of derivation. Verbatim
stdout:

$ cd src/mcp/vice && node --test vsf-slice.test.ts

```
✔ FIRST_MODULE_OFFSET is 58 -- the second magic block is accounted for (3.248976ms)
✔ MIN_C64MEM_BODY_LEN is 65543 and V01_C64MEM_BODY_LEN is 65555, and neither is 4 + 65536 (0.49731ms)
✔ MODULE_HEADER_LEN is 22 and the size field sits at header offset 18 (1.437207ms)
✔ listSnapshotModules: returns the well-formed fixture's modules in file order (2.260006ms)
✔ listSnapshotModules: the walk ends at EXACTLY the file length (0.607655ms)
✔ listSnapshotModules: every module's declared extent lies inside the file (1.042824ms)
✔ sliceC64Mem: a well-formed minor-1 snapshot yields exactly 65536 bytes of RAM (5.828963ms)
✔ sliceC64Mem: the returned image is the RAM ARRAY, not the 4-byte port prefix (1.020544ms)
✔ sliceC64Mem: dataOut/dataRead/dirRead come from the 3-byte SUFFIX after the RAM array (1.294069ms)
✔ sliceC64Mem: reports snapshotMinor 1 and bodyLength 65555 for the minor-1 fixture (1.605751ms)
✔ sliceC64Mem: the returned image is a COPY -- writing it does not touch the snapshot bytes (0.652009ms)
✔ VsfSliceError is the module's own named error type (1.644142ms)
✔ vsf-slice.ts imports nothing from this repo -- only node: builtins, and only in the CLI region (21.854648ms)
✔ vsf-slice.ts's LIBRARY region performs no filesystem, subprocess or network I/O (14.728909ms)
✔ the CLI entry point is guarded: main() is only reachable behind the entry-point check (4.639454ms)
✔ importing vsf-slice.ts runs nothing: a fresh process that only imports it exits 0 and prints nothing (253.487857ms)
✔ the CLI writes exactly 65536 bytes for a well-formed snapshot and exits 0 (251.005833ms)
✔ the CLI exits non-zero on a malformed snapshot and prints the module's OWN message, unmodified (210.958613ms)
✔ no exported function takes a filesystem path -- both take a byte array (7.539723ms)
✔ malformed module header: refuses at the offset, naming it, and says it did not rescan (1.719364ms)
✔ the refusal DISCRIMINATES: the well-formed fixture in the same test does not throw (0.734121ms)
✔ malformed module header: an implementation that rescanned would reach C64MEM -- it must not (0.429335ms)
✔ short C64MEM body: refuses naming both the observed 65542 and the minimum 65543 (0.423864ms)
✔ the body-length BOUNDARY, as a boundary: 65543 is accepted and 65542 is refused (0.790635ms)
✔ snapshot minor 0: 65536 RAM bytes, snapshotMinor 0, bodyLength 65543, suffix bytes present (0.857576ms)
✔ no C64MEM module: refuses listing the module names that WERE found (0.651566ms)
✔ a name that merely CONTAINS C64MEM does not match -- C64MEMHACKS is a real adjacent module (0.680884ms)
✔ two C64MEM modules: refuses naming the count and both offsets, never first-wins (0.555496ms)
✔ a zero-byte input is refused by name, never as a short buffer (0.416801ms)
✔ an input one byte short of a file header plus one module header is refused by name (0.374393ms)
✔ a file long enough but without the snapshot magic is refused by name (0.177525ms)
✔ a walk that does not end exactly at the file length is refused, naming both numbers (0.642637ms)
✔ every .vsf fixture has a sidecar declaring itself synthetic and naming its generator (4.120244ms)
✔ vsf-slice.ts is in package.json files[] and no fixtures entry is (0.681296ms)
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1244.160285
exit=0
```

`fail 0`, 34 tests. Raw capture at `PROBE_DIR/vsf-slice-suite.txt`.

## `$ cd src/mcp/vice && node --test capture-predicate.test.ts capture-seam.test.ts`

The second of `SLICER:`'s two declared transcripts -- the half `33-04` could not produce.
Verbatim stdout:

$ cd src/mcp/vice && node --test capture-predicate.test.ts capture-seam.test.ts

```
✔ the committed transient allow-list size cap is 64, and the oracle has four scalar terms (4.593411ms)
✔ both new modules are in package.json files[], or every structural census over them is vacuous (0.864301ms)
✔ compareCaptures: three differing addresses, two allow-listed -- the third fails and the lists are ascending (19.854599ms)
✔ compareStopIdentity: two identical stops are identical, and a differing frame line reports exactly that term (1.285681ms)
✔ compareCaptures refuses an image of the wrong length, naming the length -- never a trivial equivalence (7.149855ms)
✔ normalisePorts returns a COPY -- the caller's image is unchanged after the call (1.114668ms)
✔ argvDigest is order-sensitive and refuses an empty array by name (1.828164ms)
✔ neither module imports anything but node builtins -- no path-translation seam, and not each other (22.986611ms)
✔ no exported function in either module takes a filesystem path -- every one takes bytes, scalars or a parsed value (15.139224ms)
✔ the report vocabulary is carried across in kind: hex4, hex2, bin8 and popcount behave as compare.mjs's do (5.599066ms)
✔ compareStopIdentity refuses a stop record missing a term, naming the term and the side (1.214813ms)
✔ planted ONE-BIT difference outside the allow-list FAILS, and the same pair before the plant PASSES (8.058855ms)
✔ the predicate does not distinguish bit counts: a full-byte difference at the same address fails identically (2.561561ms)
✔ planted ONE-BIT difference AT an allow-listed address is allowed -- proving the earlier red was not a blanket refusal (1.356217ms)
✔ parseAllowList accepts exactly 64 entries and refuses 65, naming both numbers and returning no artifact (2.321792ms)
✔ compareCaptures refuses a bare allow-list array over the cap too, so the array form is not a widening route (1.859385ms)
✔ parseAllowList refuses range-shaped entries by name, and the same addresses written individually parse (2.117073ms)
✔ parseAllowList refuses a duplicate address, an out-of-range address and a missing release (0.847164ms)
✔ adjacency: with only $1000 allow-listed, $1000 is allowed while $0FFF and $1001 each fail (3.324782ms)
✔ an EMPTY allow-list is legal, and two byte-identical images compare equivalent under it (2.552213ms)
✔ a single-address allow-list over a zero-difference pair reports empty differing AND empty allowed (1.41766ms)
✔ compareCaptures is symmetric in its two arguments, and differing is ascending by address (4.331659ms)
✔ the allowed list is ascending too, whatever order the allow-list enumerated (1.5733ms)
✔ a pair differing ONLY at $0000/$0001 is equivalent after normalisation and NOT equivalent without it (11.611904ms)
✔ normalisePorts refuses a wrong-length image and a non-byte port value, naming what it saw (0.654883ms)
✔ argvDigest is NUL-joined, so an argument containing a space is not the same as two arguments (0.365474ms)
✔ REPRO-03 adjacency: identical pc and hitCount but a frame position one frame apart is NOT identical (0.245303ms)
✔ compareStopIdentity is symmetric, and differingTerms is ordered as ORACLE_TERMS (0.171266ms)
✔ compareStopIdentity refuses every absent or non-integer term, on either side, naming both (10.714754ms)
✔ CAP-03: the predicate and the oracle name no import specifier for each other, in either direction (46.264253ms)
✔ CAP-03: no exported function signature in the oracle declares an image-buffer parameter (23.008645ms)
✔ planted violation (a): a MULTI-LINE static import of the oracle from the predicate is reported (30.559482ms)
✔ planted violation (b): a static import of the predicate from the oracle is reported -- the OTHER direction (17.880339ms)
✔ planted violation (c): a DYNAMIC import() of one module from the other is reported (16.310529ms)
✔ planted violation (d): an oracle-shaped module whose exported comparison declares a Uint8Array parameter is reported (7.807596ms)
✔ negative control: an image type named only in a COMMENT or a message string is not reported (1.598343ms)
✔ non-vacuity: the scanned shipped set is substantial and contains the census's three modules by name (4.464824ms)
✔ non-vacuity: the specifier extractor finds the real modules' real specifiers (10.944545ms)
✔ non-vacuity: a census asked to scan a set that omits its module THROWS rather than reporting clean (10.484062ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 574.450672
exit=0
```

`fail 0`, 39 tests. Raw capture at `PROBE_DIR/predicate-seam-suite.txt`.

## `$ cd src/mcp/vice && npm run typecheck`

Not part of `SLICER:`'s declared derivation. Recorded because both new modules are TypeScript
run by Node's native type-stripping, so a type error would never surface at runtime and a
suite reporting `fail 0` on an ill-typed module would be a false green.

$ cd src/mcp/vice && npm run typecheck

```

> @henols/vice-mcp@0.0.0-dev typecheck
> tsc --noEmit -p tsconfig.json

exit=0
```

No line matching `error TS`. Raw capture at `PROBE_DIR/typecheck.txt`.

---

## What the two suites actually prove, in the order a reader will want it

**The predicate can FAIL.** `capture-predicate.test.ts` plants **exactly one bit** at an
address outside the allow-list and asserts the comparison reds -- with the same pair, before
the plant, asserted green in the same test. The plant is one bit and not one byte because the
vocabulary ancestor this predicate replaces (`src/skills/c64-ram-capture/scripts/compare.mjs`)
classifies a one-bit difference as "drift" and lets it PASS anywhere: a whole-byte plant would
have gone green against that inherited rule and proven nothing. The suite also asserts a
one-bit plant **at** an allow-listed address is allowed, which is what attributes the first red
to the plant rather than to a blanket refusal.

**The allow-list cannot be widened into a pass.** A 64-entry list parses; a 65-entry list
throws with both `65` and `64` in the message and returns **no artifact** -- the cap voids the
derivation rather than warning and continuing. Range-shaped notation is refused by name, in
both the `start`/`end` and the two-element-span forms, paired with the enumerated form of the
same addresses parsing.

**The `$0000`/`$0001` overlay is normalised in code, once, from the right fields.** The pairing
is the proof: the same pair compares `not-equivalent` **without** normalisation and
`equivalent` **with** it, and `$0000` receives `dirRead` while `$0001` receives `dataRead`
(47 and 55, the measured live pair, so an address swap reds). The normalised buffer is a
**copy** -- asserted by checking the caller's image is unchanged after the call, which is the
`Buffer.prototype.slice`-is-`subarray` hazard `33-04` measured, in the one place that would
otherwise write into snapshot bytes.

**The captured 64K is barred by shape from the oracle.** `capture-seam.test.ts` runs a
bidirectional import census over `shippedTsModules()` and a signature census over the oracle's
exported functions, each with a planted positive control and a clean control over the real tree.
Four plants: a multi-line static import of the oracle from the predicate, a static import of the
predicate from the oracle, a dynamic `import()`, and an oracle-shaped module whose exported
comparison declares a `Uint8Array` parameter. A fifth test is the negative control: an image
type named only in a comment or a message string is **not** reported.

---

## ACCEPTED LIMIT — one route to the circularity that neither census can see

`CAP-03`'s edge was classified `unclassified` by the deterministic edge probe and carried into
`33-07-PLAN.md` as an explicit flagged assumption; this is the same limit, recorded where the
verdict document will collect it.

The two structural assertions bar the capture from the oracle by **import** and by
**parameter type**. They cannot see a third route: a caller that reads the capture itself and
passes a **derived scalar** into `compareStopIdentity` -- a digest, a differing-address count,
an equivalence verdict -- has reintroduced the circularity through a `number`, and no signature
or import census can distinguish that `number` from a legitimately-read register value.

What would falsify the assumption that the two assertions are together sufficient: exactly such
a call site. `stop-oracle.ts`'s own `WHAT NOT TO DO` names the derived-scalar route as the
realistic one and forbids it in prose, which is the weaker instrument the stronger two cannot
reach. Recorded here so a later reviewer weighs it rather than discovering it.

---

## The outcome line

Both declared suites report `fail 0`, and both transcripts are appended above. By
`SCHEMA.md` § 2.4's declared derivation, and by nothing else:

SLICER: validated
