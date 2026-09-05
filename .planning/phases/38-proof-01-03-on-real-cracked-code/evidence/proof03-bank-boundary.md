# PROOF-03 -- the `$01` bank boundary, measured in both directions (Phase 38, plan 38-02)

**What this record is:** a fresh, self-contained transcript establishing, by observation and in
both directions, the point where a single forward-carried `$01` value stops being correct --
against the committed synthetic fixture `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a` /
`.prg` that banks ROM in and out. `PROOF-03` is the highest-risk item on the pivot's own record
and was previously recorded unmeasured in both directions. The substance was already measured in
Phase 37's `37-06` plan, badged `AUTO-04`/`AUTO-05`, never `PROOF-03`. Per D-04, this record
RE-RUNS that measurement under this phase's own evidence conventions
(`evidence/SCHEMA.md`, `evidence/README.md`) rather than citing Phase 37's files by reference --
a reader can verify `PROOF-03`'s claim from this one file, without opening
[`37-06-bank-decode-bypass-red.md`](../../37-the-importer-and-the-automatic-annotation-join/evidence/37-06-bank-decode-bypass-red.md)
or
[`37-06-path-dependent-decline-red.md`](../../37-the-importer-and-the-automatic-annotation-join/evidence/37-06-path-dependent-decline-red.md).
Those two files are cited here explicitly as PRIOR ART -- they were badged `AUTO-04`/`AUTO-05`,
and this record is the fresh Phase-38 measurement, taken this session, with its own driver
(`evidence/proof03-bank-boundary.mjs`).

Date: 2026-09-05. Driver: `evidence/proof03-bank-boundary.mjs` (committed this plan, Task 1).

Whatever each direction turned out to be, it is recorded below -- per this plan's own
prohibition, only the favourable direction is never the one that gets recorded.

---

## Part 0: the broker precondition (README.md convention 3)

Every live run in this phase is taken with the VICE broker confirmed **stopped**. Verified
before any subcommand ran:

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

`BROKER_STATE: inactive`

`TEST_AUTOMATED_BASELINE` is cited, never re-derived, from `evidence/README.md`:
`tests 3525 / pass 3512 / fail 2` (both pre-existing `anno-register.test.ts` failures, unrelated
to this plan). This measurement's own `test:automated` comparison is reported in Part 4 below, as
the relation the convention requires (at or below this floor), never as "clean" or "0 failures".

---

## Part 1: the fixture, and what is being measured

`src/mcp/vice/fixtures/ghidra/bank-path-dependent.a`, the whole fixture (42 lines), real and
committed:

```asm
; Banking fixture: a SINGLE shared program point reached under TWO DIFFERENT $01 values.
; `bank.a` (the sibling fixture this one exists because of) is straight-line code: three
; separate $D020 program points, none of them reached from two callers or two bank
; contexts. This fixture instead calls ONE subroutine ("probe") TWICE -- once right
; after $01=$34, once right after $01=$33 -- so `probe`'s own border-colour store and
; `lda $d000,x` instructions each occupy exactly ONE address, reached from TWO callers,
; under two determinate and DIFFERENT bank states.
;
; The two decodes, recorded as facts, not folklore:
;   $34 = %00110100 : bits 1-0 (LORAM/HIRAM) clear -> $D000-$DFFF reads as RAM,
;     REGARDLESS of bit 2 (CHAREN). `bank.a`'s own inline comment mislabels $34 as
;     having bit 2 clear -- it does not; bit 2 (0b100) is SET in $34. The RAM outcome
;     it states is nevertheless right, because the RAM case depends only on bits 1-0.
;   $33 = %00110011 : bits 1-0 set, bit 2 clear -> $D000-$DFFF is Character ROM.
        * = $0801
        !byte $0b,$08,$0a,$00,$9e,$32,$30,$36,$34,$00,$00,$00
        * = $0810
start:
        sei
        lda #$34                ; %00110100 : bits 1-0 clear -> $D000-$DFFF reads as RAM
        sta $01
        jsr probe                ; call 1 -- probe's writes/reads run under $01=$34

        lda #$33                ; %00110011 : bits 1-0 set, bit 2 clear -> Character ROM
        sta $01
        jsr probe                ; call 2 -- SAME address, SAME instructions, $01=$33 now

        lda #$37                ; restore: BASIC in, KERNAL in, I/O in
        sta $01
        cli
        rts

; probe: the SHARED program point this fixture exists to create. One border-colour
; store and one `lda $d000,x` -- each is ONE instruction at ONE address, reached from
; the two callers above, under two different $01 values.
probe:
        lda #$aa
        sta $d020               ; the shared write -- reached twice: $01=$34, then $01=$33
        ldx #$00
        lda $d000,x             ; the shared read -- reached twice: $01=$34, then $01=$33
        sta $3000,x
        rts
```

The real committed Ghidra export this driver parses, `export-bank-path-dependent.txt`, carries
these two sections (excerpted; the full file is 4720 lines, mostly the per-address
`## CLASSIFICATION` table):

```
## REFERENCES
0815 -> 0001 WRITE
0817 -> 0825 UNCONDITIONAL_CALL
081c -> 0001 WRITE
081e -> 0825 UNCONDITIONAL_CALL
0823 -> 0001 WRITE
## REFERENCE_COUNT 5
...
## CONST_WRITES
0815 0001 0x34
081c 0001 0x33
0823 0001 0x37
## CONST_WRITES_COUNT 3
```

Note what the `## REFERENCES` section does **not** contain: no edge into `$D020` or `$D000` at
all. The two `UNCONDITIONAL_CALL` rows target `$0825` (`probe` itself), not the addresses `probe`
writes/reads internally -- the `.prg`-route capture's own internal-`jsr` limitation, already
recorded against this same fixture in `37-06-path-dependent-decline-red.md`. Reachability to the
shared address (`$D020`, this record's own choice, consistent throughout) is therefore authored
directly via `putXref()` inside the driver, exactly as `37-06`'s own transcripts and
`anno-bank.test.ts`'s two committed planted-violation cases already do -- never a private
re-implementation of xref discovery, and never the automatic `REFERENCES` scan (which cannot
prove this edge for this fixture).

---

## Part 2: Direction 1 -- the two-bank-states observation

Does the SAME address (`$D020`) annotate differently under the two recovered `$01` values ($34,
$33)?

```
$ node .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.mjs direction1
PROOF03_FIXTURE: src/mcp/vice/fixtures/ghidra/bank-path-dependent.a
PROOF03_FIXTURE_PRG_SHA256: 5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078
PROOF03_EXPORT_SHA256: d02a7a2705f171e07f21ea98fd608df2e175d507faed324e96e2512ae1497882
CONST_WRITES (sorted ascending by storeAddress):
  storeAddress=$815 targetAddress=$1 value=$34
  storeAddress=$81c targetAddress=$1 value=$33
  storeAddress=$823 targetAddress=$1 value=$37
DECODE_BANK_STATE_0x34: raw=$34 ioRange=ram basicRange=ram kernalRange=ram
DECODE_BANK_STATE_0x33: raw=$33 ioRange=character_rom basicRange=basic_rom kernalRange=kernal_rom
IS_BANK_CONDITIONAL_ADDRESS($d020): true
RESOLVE_BANKED_REGION_UNDER_0x34: ram
RESOLVE_BANKED_REGION_UNDER_0x33: character_rom
DIRECTION1_LABEL_UNDER_0x34: I/O Area (memory mapped chip registers), Character ROM or RAM area (4096 bytes);...
DIRECTION1_LABEL_UNDER_0x33: Shape of characters in uppercase/graphics character set (2048 bytes, 256 entries)
PROOF03_TWO_BANK_STATES: differ
```

`decodeBankState()` itself confirms the fixture's own bit-2 self-correction (lines 9-11 of the
`.a` above) as an OBSERVATION rather than a trusted comment: `$34`'s `ioRange` is `ram` (bits #1-0
clear, so the I/O range reads as RAM regardless of bit #2, which IS set in `$34` -- `0x34 & 0x04 !=
0`), and `$33`'s `ioRange` is `character_rom` (bits #1-0 set, bit #2 clear). The two labels differ
by direct string inequality: under `$34` the shared `$D020` write resolves to the RAM-constrained
candidate ("I/O Area (memory mapped chip registers), Character ROM or RAM area..."); under `$33`
it resolves to the Character-ROM-constrained candidate ("Shape of characters in
uppercase/graphics character set..."). Neither label is the ordinary, unconstrained
"Border color (only bits #0-#3)" label a bank-unaware lookup would produce (see Part 3's `absent`
branch below, where that ordinary label DOES appear).

`PROOF03_TWO_BANK_STATES: differ`

---

## Part 3: Direction 2 -- the forward-carry observation

At the disagreeing-values program point (`$D020`, reached under BOTH `$34` and `$33`), does
forward-carrying the first (ascending) reaching value produce a confident, specific, WRONG
annotation where the committed code correctly declines?

The committed decline branch (`src/mcp/vice/anno-join.ts`, the "several values resolving to
different regions" case) was replaced, in a `mkdtempSync` scratch tree under
`PROBE_DIR=$HOME/.cache/c64-re-tools/phase38` ONLY, with a forward-carry that takes the FIRST
(ascending) reaching value and annotates with its own region -- exactly as an implementation that
carried a single bank value forward past a disagreement would. The scratch tree also holds
re-export shims for `anno-join.ts`'s sibling imports (`anno-bank.ts`, `anno-store.ts`,
`memmap-lookup.ts`, `anno-graphics.ts`), forwarding by absolute path to the real, unmutated files
-- none of those siblings needed mutating, only resolving. The mutated module is reached by a
dynamic, in-process `import()` of the scratch copy -- never a child process, never `git status`
shelled out to (this driver imports no child-process module at all; see
`proof03-bank-boundary.mjs`'s own header). The mutation was driven from the real committed
capture's own two facts (`$34` at `$0815`, `$33` at `$081c`), both wired to reach `$D020` via
`putXref()`.

```
$ node .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.mjs direction2
PROOF03_FIXTURE: src/mcp/vice/fixtures/ghidra/bank-path-dependent.a
PROOF03_FIXTURE_PRG_SHA256: 5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078
PROOF03_EXPORT_SHA256: d02a7a2705f171e07f21ea98fd608df2e175d507faed324e96e2512ae1497882
DIRECTION2_COMMITTED_OUTCOME: declined
DIRECTION2_COMMITTED_REASON: $d020 is reached under disagreeing processor-port values: $33(character_rom), $34(ram)
DIRECTION2_COMMITTED_DECLINED_COUNT: 1
ANNO_JOIN_TS_SHA256_BEFORE: 70060b7c1f7883666f06832c637f5dccc6154b8ab3ab53a77897180b063705cf
ANNO_BANK_TS_SHA256_BEFORE: 13fc58ba0ea06a893b8916a395b04d85acabda96168a67cb51277662e435b3cc
DIRECTION2_MUTATED_OUTCOME: annotated
DIRECTION2_MUTATED_REASON: reached under differing processor-port values ($33) that all resolve to the same region (character_rom)
DIRECTION2_MUTATED_LABEL: Shape of characters in uppercase/graphics character set (2048 bytes, 256 entries)
DIRECTION2_MUTATED_DECLINED_COUNT: 0
ANNO_JOIN_TS_SHA256_AFTER: 70060b7c1f7883666f06832c637f5dccc6154b8ab3ab53a77897180b063705cf
ANNO_BANK_TS_SHA256_AFTER: 13fc58ba0ea06a893b8916a395b04d85acabda96168a67cb51277662e435b3cc
ANNO_JOIN_AND_ANNO_BANK_UNCHANGED: yes
PROOF03_FORWARD_CARRY_WRONG_AT: $d020
```

**Under the committed (unmutated) module:** `$D020`'s decision `declined`, its reason naming
BOTH `$33(character_rom)` and `$34(ram)`, `counts.declined` reading `1`, and no comment written.

**Under the forward-carry (mutated) module:** `$D020`'s decision `annotated`, its label
`"Shape of characters in uppercase/graphics character set (2048 bytes, 256 entries)"` -- the
SAME label the character-ROM-constrained candidate set independently produces for `$33` alone
(Direction 1's own `DIRECTION1_LABEL_UNDER_0x33` line above), confirming the mutation produced a
confident, specific, WRONG annotation (it silently discarded the disagreement with `$34`) rather
than merely "some different outcome". `counts.declined` reads `0`.

This matches `37-06-path-dependent-decline-red.md`'s own prior observation exactly in substance
(the committed code declines with `counts.declined: 1`, the forward-carry annotates with the
ascending-first value's own label) -- this record's own driven numbers agree with that prior
result rather than diverging from it.

`PROOF03_FORWARD_CARRY_WRONG_AT: $d020` (the mutated run's confident label
`"Shape of characters in uppercase/graphics character set (2048 bytes, 256 entries)"` versus the
committed run's decline reason naming both `$33(character_rom)` and `$34(ram)`).

**Cleanliness, observed rather than asserted.** The driver's own byte-identity check
(`sha256` of `anno-join.ts` / `anno-bank.ts`, before vs. after the scratch work) read
`ANNO_JOIN_AND_ANNO_BANK_UNCHANGED: yes` above -- both files hashed identically before the
mutation began and after the scratch tree was torn down. Separately, the executor's own
`git status --porcelain` (never inside the driver, which imports no child-process module) is
appended below, before and after this entire session's measurement:

```
$ git status --porcelain src/mcp/vice/anno-join.ts src/mcp/vice/anno-bank.ts
```

produced 0 lines both before any subcommand in this session ran and after all three (`direction1`,
`direction2`, `branches`) had run -- the forward-carry mutation lived only inside a `mkdtempSync`
directory under `PROBE_DIR`, never inside the committed tree.

---

## Part 4: the branch sweep -- four `constWrites` shapes, absent/empty/agreeing/disagreeing

`37-06` covered only the disagreeing-values case (Direction 2 above). This phase adds the other
three shapes `anno-join.ts`'s own doc comment distinguishes (`RunMemmapJoinArgs.constWrites`),
plus the agreeing-values case, all driven over the SAME shared address (`$D020`):

```
$ node .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-bank-boundary.mjs branches
PROOF03_FIXTURE: src/mcp/vice/fixtures/ghidra/bank-path-dependent.a
PROOF03_FIXTURE_PRG_SHA256: 5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078
PROOF03_EXPORT_SHA256: d02a7a2705f171e07f21ea98fd608df2e175d507faed324e96e2512ae1497882
PROOF03_CONSTWRITES_ABSENT_BRANCH: annotated
  label: Border color (only bits #0-#3)
PROOF03_CONSTWRITES_EMPTY_BRANCH: declined
  reason: no recovered processor-port value reaches $d020 -- declining rather than defaulting to the power-on state
PROOF03_AGREEING_VALUES_BRANCH: annotated
  reason: reached under differing processor-port values ($34) that all resolve to the same region (ram)
  label: I/O Area (memory mapped chip registers), Character ROM or RAM area (4096 bytes);...
PROOF03_DISAGREEING_VALUES_BRANCH: declined
  reason: $d020 is reached under disagreeing processor-port values: $33(character_rom), $34(ram)
ORDERING_DECISIONS_ADDRESSES (inserted $d030 then $d020): $d020, $d030
ORDERING_DECISIONS_ASCENDING: yes
ORDERING_DECLINE_REASON_VALUES_ASCENDING: $d020 is reached under disagreeing processor-port values: $33(character_rom), $34(ram)
PROOF03_ORDERING: decisions[] is address-ascending regardless of insertion order (confirmed above); a decline reason lists disagreeing values in ascending numeric order (see ORDERING_DECLINE_REASON_VALUES_ASCENDING above)
```

Read one at a time:

- **`constWrites` absent** (`undefined`, every pre-`37-06` call site): the bank-state machinery is
  a COMPLETE NO-OP, so `$D020` resolves through the ordinary unconstrained path -- and it DOES
  annotate, with the ordinary "Border color (only bits #0-#3)" label, NEITHER of the two
  bank-constrained labels Direction 1 observed. This is the observable difference the `undefined`
  case makes: no bank reasoning happens at all.
- **`constWrites` empty** (`[]`, activated with zero facts): no recovered value can reach the
  address, so it DECLINES with a reason naming the absence -- it never defaults to the power-on
  value (`$37`; the reason text above names neither `$37` nor any other value).
- **Agreeing values**: two DISTINCT const-write facts (synthetic store addresses, since the real
  capture carries only one fact per distinct value) carrying the SAME `$34` value, both wired to
  reach `$D020`. It ANNOTATES -- the values disagree as facts (two distinct facts) but the REGION
  they resolve to agrees (both `ram`), and the decision's own reason records that: "reached under
  differing processor-port values ($34) that all resolve to the same region (ram)".
- **Disagreeing values**: the real capture's own `$34` and `$33` facts, both wired to reach
  `$D020` -- the SAME scenario Direction 2's committed run exercises, reproduced here for the
  branch sweep's own completeness. DECLINES, reason naming both values.

**Ordering rule, observed:** `runMemmapJoin()`'s returned `decisions[]` is address-ascending
regardless of the order xrefs were inserted in -- `$D030` was wired BEFORE `$D020` above, and the
returned array still reads `$d020, $d030`. A decline reason naming disagreeing values lists them
in ASCENDING NUMERIC VALUE order, independent of which store address (and therefore which
insertion order) produced which value -- `$33` (51 decimal) is named before `$34` (52 decimal)
above, even though `$34`'s own const-write fact sits at the LOWER store address (`$0815` <
`$081c`).

`PROOF03_AGREEING_VALUES_BRANCH: annotated`
`PROOF03_DISAGREEING_VALUES_BRANCH: declined`
`PROOF03_CONSTWRITES_ABSENT_BRANCH: annotated`
`PROOF03_CONSTWRITES_EMPTY_BRANCH: declined`
`PROOF03_ORDERING: decisions[] returns in address-ascending order regardless of xref insertion order; a decline reason names disagreeing values in ascending numeric value order regardless of which store address (and insertion order) produced them`

---

## Part 5: `test:automated`, measured with the broker stopped

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1

$ cd src/mcp/vice && npm run test:automated

> @henols/vice-mcp@0.1.0 test:automated
> node test-gate.mjs

[... individual test lines omitted; final summary block below ...]

ℹ tests 3525
ℹ suites 24
ℹ pass 3512
ℹ fail 2
ℹ cancelled 0
ℹ skipped 6
ℹ todo 5
```

`tests 3525 / pass 3512 / fail 2` -- at the recorded `TEST_AUTOMATED_BASELINE` floor
(`evidence/README.md`), both failures the same two pre-existing `anno-register.test.ts`
`STORE-*`/`MCP-04` undeclared-requirement-id findings the baseline already names, unrelated to
this plan's own work. Per this phase's convention 4, compared as a RELATION (at or below the
floor), never re-derived and never a gate. An earlier run in this same session observed a
transient 4-failure result (two additional `audit-root-args.test.ts:982` failures,
`ENOENT ... zz-scratch-in03-negative.md`) -- the known inter-file scratch-file race between test
files, unrelated to this plan, that clears on re-run; the run recorded above is the re-run.

`BROKER_STATE: inactive`

`PROOF03_CAPTURE_PAIR: none` -- this measurement takes no live capture at all (no VICE instance
was ever acquired), so `GATE-01`'s two-term `(PC, hit_count)` narrowing has nothing to attach to
here.

---

## Part 6: outcome-line summary

```
PROOF03_FIXTURE: src/mcp/vice/fixtures/ghidra/bank-path-dependent.a
PROOF03_FIXTURE_PRG_SHA256: 5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078
PROOF03_EXPORT_SHA256: d02a7a2705f171e07f21ea98fd608df2e175d507faed324e96e2512ae1497882
PROOF03_TWO_BANK_STATES: differ
PROOF03_FORWARD_CARRY_WRONG_AT: $d020
PROOF03_AGREEING_VALUES_BRANCH: annotated
PROOF03_DISAGREEING_VALUES_BRANCH: declined
PROOF03_CONSTWRITES_ABSENT_BRANCH: annotated
PROOF03_CONSTWRITES_EMPTY_BRANCH: declined
PROOF03_ORDERING: decisions[] returns in address-ascending order regardless of xref insertion order; a decline reason names disagreeing values in ascending numeric value order regardless of which store address (and insertion order) produced them
PROOF03_CAPTURE_PAIR: none
BROKER_STATE: inactive
```

---

## What this does and does not establish

**Covered:** one shared program point (`$D020`, the fixture's own `probe` subroutine's
border-colour store), under two determinate `$01` values (`$34`, `$33`) recovered from a REAL
`analyzeHeadless` export of a REAL assembled `.prg`. All four `constWrites` shapes
`runMemmapJoin()`'s own doc comment distinguishes were exercised against this same address:
absent, empty, agreeing-values (two facts, same value), disagreeing-values (two facts, different
values, the real capture's own pair).

**Not covered, named rather than glossed:**

- The fixture (`bank-path-dependent.a` / `.prg`) is a SYNTHETIC ACME program, hand-written for
  this plan and Phase 37's `37-06`, purpose-built to create exactly one shared program point
  reached under two bank states. It is not a real cracked release.
- This record establishes NOTHING about whether `danish.d64`'s `BRUCE LEE   (DC)` (PROOF-01's own
  real corpus release) itself ever writes `$01` more than once, or reaches any bank-conditional
  address under more than one recovered value. That is an open question this measurement does not
  touch -- named explicitly rather than left implied by the fixture's own realism.
- Only ONE address (`$D020`) was driven through all four `constWrites` shapes; the fixture's
  second shared point (`probe`'s own `lda $d000,x` at a different address) was not separately
  swept through the branch cases, though Direction 1/2's own single-value and disagreeing
  observations at `$D020` are the substantive claims this record makes.
- Per D-37-24 (carried forward from Phase 37, never softened here): the reaching-values
  computation is NOT a dataflow analysis. It is a conservative forward walk over the stored
  cross-reference graph, and a real binary's decline count under this same logic will be HIGHER
  than a fuller analysis would produce -- the deliberate trade this project made, because a
  decline is a stated absence and a stated absence beats a confident guess.

**The fixture's own bit-2 self-correction, carried forward, never contradicted:** `$34`'s bit #2
(CHAREN) IS set (`0x34 & 0x04 != 0`, confirmed by this record's own `DECODE_BANK_STATE_0x34` line
above: `ioRange=ram`); the RAM outcome the fixture's own header comment states is nonetheless
right, because the RAM case at the I/O range depends only on bits #1-0, never on bit #2.
