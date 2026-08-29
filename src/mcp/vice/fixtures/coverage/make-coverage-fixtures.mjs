#!/usr/bin/env node
// make-coverage-fixtures.mjs -- the reproducible generator for COV-02's twelve
// committed control fixtures.
//
// WHY A GENERATOR RATHER THAN TWELVE HAND-COMMITTED BLOBS: the twelve fixtures
// are four groups, and each group's defining property is a SAMENESS or a
// CHECKED NEGATIVE that only a generator can hold.
//
//   * The five findings controls (NC1..NC5) are the SAME 64-byte program with
//     a different STORE attached. If each were hand-assembled, a change to the
//     program would silently drift five controls apart from each other and the
//     independence claim ("only the store differs") would stop being true
//     without anything failing.
//   * The census false-positive PAIR (FP1, FP1b) carries its own two programs,
//     which are byte-identical apart from a seven-byte code prologue -- one
//     indexed, one immediate. That only-difference-is-the-addressing-mode
//     relationship IS the fixture: comparing the census of the two is
//     meaningless if they differ anywhere else. Hand-committing them would let
//     the relationship drift silently, so the pair is generated TOGETHER and
//     the generator THROWS unless the two payloads are equal in length and
//     byte-identical from the end of the prologue onward.
//   * The dispatch gate's INTERIOR control PAIR (FP2, FP2b) carries a third
//     and fourth program whose defining property is a NEGATIVE: each must build
//     a zero-page vector, index two tables through one register, resolve an
//     orientation, reconstruct eight decodable targets -- and dispatch NOWHERE.
//     "Dispatches nowhere" is enforced here by a throw on any `$6c` or `$48`
//     byte anywhere in either image, so it is a checked fact rather than a
//     claim in a comment. The pair carries the same equal-length and
//     identical-tail throws FP1/FP1b does, for the same reason: FP2's census
//     is only meaningful against a MEASURED twin.
//   * The CLASS-3 push-idiom route's INTERIOR control PAIR (FP3, FP3b) carries
//     a fifth and sixth program whose defining property is a pair of CHECKED
//     opposites: the image must carry NO `$6c` byte anywhere (nothing dispatches
//     through the reconstructed tables) and its prologue MUST carry the
//     `pha`/`pha`/`rts` idiom (so the payload genuinely enters the region the
//     class-3 branch rules on). `assertDispatchesNowhere()` cannot express that
//     -- it throws on `$48` -- so the pair carries its own two throws,
//     `assertNoIndirectJumpOpcode()` and `assertCarriesPushIdiom()`, alongside
//     the same equal-length, 64-byte, prologue-length and identical-tail throws
//     the other two pairs carry.
//
// Every fixture's project file is produced by this repository's own real
// `synthesizeProject()` -- never hand-assembled JSON -- so the payload format
// is the one the shipped writer emits.
//
// DETERMINISM IS PART OF THE CONTRACT: running this script twice must leave
// `git status --porcelain src/mcp/vice/fixtures/coverage` empty. There is no
// timestamp, no random value and no host-dependent path in any emitted file.
//
// THE FILENAME DELIBERATELY CARRIES NO TEST SUFFIX. `ci-suite-coverage.test.ts`
// derives the set of directories holding committed test files from the repo
// itself and requires each to be covered by a CI step; a `*.test.mjs` here
// would register `fixtures/coverage` as a suite directory that no CI step
// runs. `.mjs` with a plain name keeps that guard unaffected.
//
// Regenerate with:
//   cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// THE FROZEN PROJECT-FILE WRITER (plan 29-10, 2026-08-30).
//
// This function used to be imported from the retired static-analysis
// integration's own project module, which plan 29-10 deleted. It is inlined
// here, emitting BYTE-FOR-BYTE the same JSON that module emitted -- proven by
// this generator's own determinism contract above, which now does double duty:
// re-running it must leave `git status --porcelain` on this directory EMPTY,
// so a single changed byte in any of the twelve committed
// `project.regen2000proj` files fails the check.
//
// WHY INLINE RATHER THAN RE-POINT ONTO THIS PROJECT'S OWN STORE. The twelve
// fixtures' consumers read the ANALYSER's project file. Re-pointing the writer
// at the Phase 28 annotation store would re-derive all twelve committed
// fixtures and change what the census controls measure -- which is Phase 30's
// work, on Phase 30's evidence, not a side effect of a deletion. The deleted
// module's own classification entry says the same thing in the other
// direction: once the store is this project's own, there is no such file to
// synthesise.
//
// WHAT THAT MEANS FOR A LATER READER: after plan 29-10's commit, THE TWELVE
// COMMITTED FIXTURES ARE THE ONLY REMAINING RECORD OF THIS FILE FORMAT. There
// is no other producer in this repo and no specification of it anywhere. If
// this writer and those fixtures ever disagree, the fixtures are the
// authority, not this code.
//
// PHASE 30 re-points this writer when the store-native project file lands.
// Until then it is frozen: do not "improve" the shape, the key order, or the
// compression, because every one of those is load-bearing for byte equality.
//
// EVERY CHECKED NEGATIVE IN THIS FILE STAYS. The equal-length and
// identical-tail throws, `assertDispatchesNowhere()`,
// `assertNoIndirectJumpOpcode()` and `assertCarriesPushIdiom()` are the reason
// this is a generator rather than twelve hand-committed blobs, and they are
// what keeps the fixtures reproducible. None of them touched the deleted
// module.
// ---------------------------------------------------------------------------

/** The system string the deleted module defaulted to, always written
 * explicitly and never omitted. */
const PROJECT_SYSTEM_C64 = "Commodore 64";

/**
 * Emits the project file for `bytes` at `origin`, byte-identically to the
 * deleted producer: gzip the payload, base64 it, and write `origin`,
 * `raw_data_base64`, an empty `blocks` array and the two forced settings, IN
 * THAT KEY ORDER, stringified with no whitespace, no timestamp and no
 * host-dependent value. The absence of all three is what makes this
 * generator's determinism contract checkable at all.
 */
function synthesizeProject(bytes, { origin, system = PROJECT_SYSTEM_C64 }) {
  if (!Number.isInteger(origin) || origin < 0 || origin > 0xffff) {
    throw new Error(
      `synthesizeProject: origin ${origin} is out of range -- expected an integer 0..0xffff (0..65535)`,
    );
  }
  if (bytes.length === 0) {
    throw new Error("synthesizeProject: payload is empty -- a project file must carry at least one byte");
  }

  const raw_data_base64 = gzipSync(bytes).toString("base64");

  const project = {
    origin,
    raw_data_base64,
    blocks: [],
    settings: {
      // Forced true, never configurable (D-05). Do not add a parameter that
      // overrides this.
      use_illegal_opcodes: true,
      // Always written explicitly, never omitted (D-05 / Phase 9's .vsf
      // finding).
      system,
    },
  };

  return JSON.stringify(project);
}

const ORIGIN = 0x0810;

// ---------------------------------------------------------------------------
// The one shared control program. 64 bytes at $0810.
//
//   $0810  jsr $0820        ; -> set_flag
//   $0813  jsr $0828        ; -> read_table
//   $0816  jsr $0820        ; -> set_flag AGAIN (this is what makes $0820 a
//                           ;    two-caller label, which is what the
//                           ;    cross-reference rule engages on)
//   $0819  lda $0840        ; a data reference
//   $081C  jmp $0830        ; -> tail_call, and a trace terminator
//   $081F  nop              ; unreachable filler
//   $0820  lda #$01         ; set_flag
//   $0822  sta $0841
//   $0825  rts
//   $0826  nop nop          ; unreachable filler
//   $0828  ldx #$00         ; read_table
//   $082A  lda $0840,x
//   $082D  rts
//   $082E  nop nop          ; unreachable filler
//   $0830  lda #$02         ; tail_call
//   $0832  rts
//   $0833  nop x13          ; unreachable filler
//   $0840  16 data bytes
//
// The unreachable filler is deliberate: it is what makes the divergence
// sub-report's "store says Code, census never reached it" direction non-zero
// on the WELL-DOCUMENTED control too, proving that direction is reported
// rather than treated as a defect.
// ---------------------------------------------------------------------------

const PROGRAM = Uint8Array.from([
  0x20, 0x20, 0x08, // $0810 jsr $0820
  0x20, 0x28, 0x08, // $0813 jsr $0828
  0x20, 0x20, 0x08, // $0816 jsr $0820
  0xad, 0x40, 0x08, // $0819 lda $0840
  0x4c, 0x30, 0x08, // $081C jmp $0830
  0xea, // $081F nop
  0xa9, 0x01, // $0820 lda #$01
  0x8d, 0x41, 0x08, // $0822 sta $0841
  0x60, // $0825 rts
  0xea, 0xea, // $0826
  0xa2, 0x00, // $0828 ldx #$00
  0xbd, 0x40, 0x08, // $082A lda $0840,x
  0x60, // $082D rts
  0xea, 0xea, // $082E
  0xa9, 0x02, // $0830 lda #$02
  0x60, // $0832 rts
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0833..$083F
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, // $0840
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, // $0848
]);

if (PROGRAM.length !== 0x40) {
  throw new Error(`the control program must be exactly 64 bytes, got ${PROGRAM.length}`);
}

// ---------------------------------------------------------------------------
// The FALSE-POSITIVE control PAIR. Two 64-byte programs at $0810, byte
// identical apart from their seven-byte code prologue.
//
// FP1 -- INDEXED_COPY_LOOP:
//
//   $0810  lda $0827,x      ; a screen copy, indexed through X
//   $0813  lda $083F,x      ; a colour copy, indexed through the SAME register
//   $0816  rts
//   $0817  10 11 ... 27     ; 24 ascending data bytes
//   $082F  08 x24           ; 24 bytes of one plausible colour value
//   $0847  20 x9            ; 9 spaces
//
// FP1b -- IMMEDIATE_COPY_LOOP: the same 64 bytes except that the two loads
// are IMMEDIATE rather than indexed, and the prologue is padded to the same
// length with `nop`:
//
//   $0810  lda #$20
//   $0812  lda #$38
//   $0814  nop
//   $0815  nop
//   $0816  rts
//   $0817..$084F  identical to FP1, byte for byte
//
// WHY THIS PAIR EXISTS. Nothing in either program dispatches through
// anything: there is no indirect jump, no `pha`/`pha`/`rts` stack-return
// idiom and no zero-page vector construction. A two-table indexed read loop
// is the single most ordinary shape in C64 code. Before the dispatch-context
// gate landed, the scan paired ANY two indexed `ld*` instructions inside a
// short window, reconstructed 8 in-image "targets" out of the 57 bytes of
// ordinary data below, fed them back as descent seeds, and reported
// reached=55 of 64 bytes against 7 bytes of real code -- while the immediate
// twin reported reached=7. That 8x inflation of the headline structural
// measure, manufactured out of data, is what this pair is a control for.
//
// The DATA REGION IS WRITTEN OUT IN FULL IN BOTH LITERALS, deliberately, and
// is not shared between them. A shared constant would make the identical-tail
// invariant below true by construction and therefore worthless; written
// twice, the invariant is a real check that a real edit can break.
// ---------------------------------------------------------------------------

/** `lda $0827,x : lda $083f,x : rts` -- the indexed prologue. */
const FP_INDEXED_PROLOGUE = [0xbd, 0x27, 0x08, 0xbd, 0x3f, 0x08, 0x60];

/** `lda #$20 : lda #$38 : nop : nop : rts` -- the immediate twin's prologue,
 * padded to exactly the same length so the two payloads are comparable. */
const FP_IMMEDIATE_PROLOGUE = [0xa9, 0x20, 0xa9, 0x38, 0xea, 0xea, 0x60];

/** The real code size of both false-positive payloads, DERIVED from the
 * prologue rather than typed as a bare number, so the non-inflation control
 * cannot drift away from the payloads it guards. */
const FP_CODE_SIZE = FP_INDEXED_PROLOGUE.length;

const INDEXED_COPY_LOOP = Uint8Array.from([
  ...FP_INDEXED_PROLOGUE, // $0810 lda $0827,x : lda $083f,x : rts
  0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, // $0817 ascending
  0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, // $081F
  0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, // $0827
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $082F one colour value
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $0837
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $083F
  0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, // $0847 spaces
  0x20, // $084F
]);

const IMMEDIATE_COPY_LOOP = Uint8Array.from([
  ...FP_IMMEDIATE_PROLOGUE, // $0810 lda #$20 : lda #$38 : nop : nop : rts
  0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, // $0817 ascending
  0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, // $081F
  0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, // $0827
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $082F one colour value
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $0837
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $083F
  0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, // $0847 spaces
  0x20, // $084F
]);

// The pair's stated relationship, ENFORCED. Ordered so that the message names
// the invariant an edit actually broke: length first (a deleted or added byte),
// then the 64-byte size, then the prologue length, then the identical tail.
if (INDEXED_COPY_LOOP.length !== IMMEDIATE_COPY_LOOP.length) {
  throw new Error(
    `the false-positive pair must be EQUAL IN LENGTH -- INDEXED_COPY_LOOP is ${INDEXED_COPY_LOOP.length} bytes and ` +
      `IMMEDIATE_COPY_LOOP is ${IMMEDIATE_COPY_LOOP.length}; comparing their censuses is meaningless unless they differ ONLY in the code prologue`,
  );
}

for (const [name, payload] of [
  ["INDEXED_COPY_LOOP", INDEXED_COPY_LOOP],
  ["IMMEDIATE_COPY_LOOP", IMMEDIATE_COPY_LOOP],
]) {
  if (payload.length !== 0x40) {
    throw new Error(`${name} must be exactly 64 bytes, got ${payload.length}`);
  }
}

if (FP_INDEXED_PROLOGUE.length !== FP_CODE_SIZE || FP_IMMEDIATE_PROLOGUE.length !== FP_CODE_SIZE) {
  throw new Error(
    `both false-positive prologues must be exactly FP_CODE_SIZE (${FP_CODE_SIZE}) bytes -- indexed is ` +
      `${FP_INDEXED_PROLOGUE.length}, immediate is ${FP_IMMEDIATE_PROLOGUE.length}; the declared code size is what the ` +
      `census is asserted not to exceed, so it may not be a number that is true of only one of the two`,
  );
}

for (let i = FP_CODE_SIZE; i < INDEXED_COPY_LOOP.length; i++) {
  if (INDEXED_COPY_LOOP[i] !== IMMEDIATE_COPY_LOOP[i]) {
    throw new Error(
      `the false-positive pair must be BYTE-IDENTICAL from offset ${FP_CODE_SIZE} onward -- they differ at offset ${i} ` +
        `($${(ORIGIN + i).toString(16)}): indexed has $${INDEXED_COPY_LOOP[i].toString(16).padStart(2, "0")}, immediate has ` +
        `$${IMMEDIATE_COPY_LOOP[i].toString(16).padStart(2, "0")}. "Differing ONLY in addressing mode" is a CHECKED property of ` +
        `these fixtures, not a claim in a comment`,
    );
  }
}

// ---------------------------------------------------------------------------
// The INTERIOR control PAIR (FP2, FP2b). Two 64-byte programs at $0810 whose
// 17-byte code prologue BUILDS A ZERO-PAGE VECTOR and then consumes it with an
// indirect-indexed DATA read.
//
// FP2 -- ZEROPAGE_DATA_POINTER:
//
//   $0810  ldx #$00
//   $0812  lda $0830,x      ; lo table, indexed through X
//   $0815  sta $fb          ; vector lo
//   $0817  lda $0838,x      ; hi table, indexed through the SAME register
//   $081A  sta $fc          ; vector hi  <- consecutive with $fb
//   $081C  ldy #$00
//   $081E  lda ($fb),y      ; reads DATA through the pointer. NOT a dispatch.
//   $0820  rts
//   $0821  ea x15           ; filler up to $0830
//   $0830  40 41 ... 47     ; eight ascending lo bytes
//   $0838  08 x8            ; eight hi bytes
//   $0840  ea x16           ; sixteen legal single-byte instructions
//
// WHY THIS CONTROL EXISTS -- and why it is a DIFFERENT KIND of control from
// FP1/FP1b. The FP1 pair carries no zero-page store at all, and the positive
// control `SPLIT_TABLE` carries a real `jmp ($00fb)`. Those two bracket the
// dispatch-context gate from the OUTSIDE. Nothing exercised its INTERIOR: a
// vector that is genuinely built -- two indexed loads through the same
// register, two stores into consecutive zero-page addresses inside the pairing
// window, a resolvable lo/hi orientation, and eight reconstructed targets that
// every one of them decodes -- and then consumed by something that is not a
// jump. That is the single most ordinary 16-bit pointer idiom on a 6502, and
// before this pair landed the gate treated the CONSTRUCTION as proof of
// dispatch (19-REVIEW.md CR-04): FP2 reported splitTables=1, eight
// provenDispatchTargets at $0840..$0847, sixteen claimed table-entry bytes and
// reached=33 of 64 against 17 bytes of real code, while its immediate twin
// reported reached=17. A negative control built from the OUTSIDE of the
// predicate it constrains is not a control at all.
//
// The no-0x6c / no-0x48 invariants below are what make "this program
// dispatches nowhere" a CHECKED property of the generator rather than a claim
// in this comment.
//
// FP2b is the immediate twin that supplies FP2's MEASURED census baseline. It
// exists for the reason FP1b does: a lone fixture asserting `reached <=
// code_size` would be satisfied by an instrument that had quietly stopped
// censusing anything, so the baseline has to be a live measurement.
// ---------------------------------------------------------------------------

/** `ldx #$00 : lda $0830,x : sta $fb : lda $0838,x : sta $fc : ldy #$00 :
 * lda ($fb),y : rts` -- the interior control's indexed prologue. */
const FP2_INDEXED_PROLOGUE = [
  0xa2, 0x00, // $0810 ldx #$00
  0xbd, 0x30, 0x08, // $0812 lda $0830,x   (lo table)
  0x85, 0xfb, //       $0815 sta $fb       (vector lo)
  0xbd, 0x38, 0x08, // $0817 lda $0838,x   (hi table)
  0x85, 0xfc, //       $081A sta $fc       (vector hi)
  0xa0, 0x00, //       $081C ldy #$00
  0xb1, 0xfb, //       $081E lda ($fb),y   <- a DATA read, not a dispatch
  0x60, //             $0820 rts
];

/** `ldx #$00 : lda #$30 : nop : sta $fb : lda #$38 : nop : sta $fc :
 * ldy #$00 : lda ($fb),y : rts` -- the interior control's immediate twin.
 *
 * The same zero-page vector is still constructed at `$fb`/`$fc` and still
 * consumed by the same `lda ($fb),y` data read; the ONLY difference is the
 * source of the two vector bytes, which changes from an indexed table read to
 * an immediate constant. Padded with `nop` so the prologue length is
 * unchanged, exactly as FP1b's is. */
const FP2_IMMEDIATE_PROLOGUE = [
  0xa2, 0x00, // $0810 ldx #$00
  0xa9, 0x30, 0xea, // $0812 lda #$30 : nop
  0x85, 0xfb, //       $0815 sta $fb
  0xa9, 0x38, 0xea, // $0817 lda #$38 : nop
  0x85, 0xfc, //       $081A sta $fc
  0xa0, 0x00, //       $081C ldy #$00
  0xb1, 0xfb, //       $081E lda ($fb),y
  0x60, //             $0820 rts
];

/** The real code size of both interior-control payloads, DERIVED from the
 * prologue rather than typed as a bare number, so the non-inflation control
 * cannot drift away from the payloads it guards. */
const FP2_CODE_SIZE = FP2_INDEXED_PROLOGUE.length;

/**
 * A prologue followed by its own 47 data bytes, CONCATENATED -- never laid into
 * a pre-sized 64-byte array.
 *
 * The layout each caller supplies is: fifteen `nop` filler bytes up to offset
 * `0x20`, then eight ascending lo bytes `$40..$47` at `$0830`, then eight `$08`
 * hi bytes at `$0838`, then sixteen `nop` bytes at `$0840`. The lo/hi pair
 * reconstructs the eight little-endian values `$0840..$0847`, and the sixteen
 * bytes there decode as legal single-byte instructions -- which is exactly what
 * makes the pre-CR-04 gate's condition (e) pass and the inflation happen. The
 * data is ORDINARY: a screen pointer table is built this way in essentially
 * every C64 program.
 *
 * TWO REASONS FOR THIS SHAPE, and both are about keeping an invariant from
 * becoming true by construction:
 *
 *   * CONCATENATED, not filled to a fixed size. A helper that padded to 64
 *     bytes would absorb any prologue edit -- the payload would stay 64 bytes
 *     no matter what -- and the 64-byte throw would be unreachable. Built this
 *     way, a plant that adds or removes one prologue byte throws.
 *   * `data` IS A PARAMETER, so each payload below carries its own written-out
 *     literal rather than sharing one. A shared region would make the
 *     identical-tail throw true by construction and therefore worthless --
 *     exactly the reasoning the FP1 pair's twice-written data region already
 *     records. Written twice, the invariant is a real check that a real edit
 *     can break.
 */
function withZeroPageVectorData(prologue, data) {
  return Uint8Array.from([...prologue, ...data]);
}

const ZEROPAGE_DATA_POINTER = withZeroPageVectorData(FP2_INDEXED_PROLOGUE, [
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0821 filler
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, //       $0829 filler
  0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, // $0830 lo bytes
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $0838 hi bytes
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0840 reconstructed targets
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0848
]);

const IMMEDIATE_DATA_POINTER = withZeroPageVectorData(FP2_IMMEDIATE_PROLOGUE, [
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0821 filler
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, //       $0829 filler
  0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, // $0830 lo bytes
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $0838 hi bytes
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0840 reconstructed targets
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0848
]);

// The interior pair's stated properties, ENFORCED. Ordered so the message names
// the invariant an edit actually broke: pair length first (a deleted or added
// byte), then the 64-byte size, then the prologue length, then the
// dispatches-nowhere property, then the identical tail.
if (ZEROPAGE_DATA_POINTER.length !== IMMEDIATE_DATA_POINTER.length) {
  throw new Error(
    `the interior control pair must be EQUAL IN LENGTH -- ZEROPAGE_DATA_POINTER is ${ZEROPAGE_DATA_POINTER.length} bytes and ` +
      `IMMEDIATE_DATA_POINTER is ${IMMEDIATE_DATA_POINTER.length}; comparing their censuses is meaningless unless they differ ONLY in the code prologue`,
  );
}

for (const [name, payload] of [
  ["ZEROPAGE_DATA_POINTER", ZEROPAGE_DATA_POINTER],
  ["IMMEDIATE_DATA_POINTER", IMMEDIATE_DATA_POINTER],
]) {
  if (payload.length !== 0x40) {
    throw new Error(`${name} must be exactly 64 bytes, got ${payload.length}`);
  }
}

if (FP2_INDEXED_PROLOGUE.length !== FP2_CODE_SIZE || FP2_IMMEDIATE_PROLOGUE.length !== FP2_CODE_SIZE) {
  throw new Error(
    `both interior-control prologues must be exactly FP2_CODE_SIZE (${FP2_CODE_SIZE}) bytes -- indexed is ` +
      `${FP2_INDEXED_PROLOGUE.length}, immediate is ${FP2_IMMEDIATE_PROLOGUE.length}; the declared code size is what the census is ` +
      `asserted not to exceed, so it may not be a number that is true of only one of the two`,
  );
}

// THE PROPERTY CR-04 TURNS ON, made a checked fact rather than a comment: the
// interior control must dispatch NOWHERE. `0x6c` is `jmp (indirect)` and `0x48`
// is `pha` (half of the stack-return idiom); a payload containing either byte
// ANYWHERE -- even as a data byte a decode could stumble onto -- can no longer
// hold down the claim "the gate declines a vector nothing jumps through".
function assertDispatchesNowhere(name, payload) {
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === 0x6c || payload[i] === 0x48) {
      throw new Error(
        `${name} must DISPATCH NOWHERE, but carries $${payload[i].toString(16).padStart(2, "0")} at offset ${i} ` +
          `($${(ORIGIN + i).toString(16)}) -- $6c is jmp (indirect) and $48 is pha, and either byte anywhere in the image makes this ` +
          `fixture unable to hold down the property it exists for: that a zero-page vector nothing jumps through is not dispatch context (CR-04)`,
      );
    }
  }
}

assertDispatchesNowhere("ZEROPAGE_DATA_POINTER", ZEROPAGE_DATA_POINTER);
assertDispatchesNowhere("IMMEDIATE_DATA_POINTER", IMMEDIATE_DATA_POINTER);

for (let i = FP2_CODE_SIZE; i < ZEROPAGE_DATA_POINTER.length; i++) {
  if (ZEROPAGE_DATA_POINTER[i] !== IMMEDIATE_DATA_POINTER[i]) {
    throw new Error(
      `the interior control pair must be BYTE-IDENTICAL from offset ${FP2_CODE_SIZE} onward -- they differ at offset ${i} ` +
        `($${(ORIGIN + i).toString(16)}): indexed has $${ZEROPAGE_DATA_POINTER[i].toString(16).padStart(2, "0")}, immediate has ` +
        `$${IMMEDIATE_DATA_POINTER[i].toString(16).padStart(2, "0")}. "Differing ONLY in addressing mode" is a CHECKED property of ` +
        `these fixtures, not a claim in a comment`,
    );
  }
}


// ---------------------------------------------------------------------------
// The class-3 push-idiom route's INTERIOR control PAIR (FP3, FP3b). Two 64-byte
// programs at $0810 whose 15-byte code prologue builds a zero-page vector out
// of two indexed table reads and then carries a `pha`/`pha`/`rts` stack-return
// idiom that pushes bytes the two paired loads never produced.
//
// FP3 -- UNLINKED_PUSH_IDIOM:
//
//   $0810  lda $0830,x      ; lo table, indexed through X
//   $0813  sta $fb          ; vector lo
//   $0815  lda $0838,x      ; hi table, indexed through the SAME register
//   $0818  sta $fc          ; vector hi  <- consecutive with $fb
//   $081A  pha              ; pushes A -- the HI table byte, already consumed
//   $081B  txa
//   $081C  pha              ; pushes X -- an index, not a table byte
//   $081D  tya
//   $081E  rts              ; the RTS trick, over bytes NEITHER load supplied
//   $081F  ea x17           ; filler up to $0830
//   $0830  40 41 ... 47     ; eight ascending lo bytes
//   $0838  08 x8            ; eight hi bytes
//   $0840  ea x16           ; sixteen legal single-byte instructions
//
// WHY THIS PAIR EXISTS, and why FP2 could not hold the property down. The
// dispatch-context predicate accepts two sufficient shapes. FP2 reaches the
// interior of the zero-page-vector shape; the three stack-return controls
// (`STACK_RETURN`, `STACK_RETURN_MIXED_REGISTERS`,
// `STACK_RETURN_IMPLAUSIBLE_TARGET`) reach the push idiom through the CLASS-4
// five-instruction window. Nothing reached the push idiom through the CLASS-3
// pairing pass, which is the route this payload takes: class 4 declines the
// window outright -- its second instruction is a `sta`, not a `pha` -- and the
// class-3 pass then examined the pairing and promoted it on the mere presence
// of two `pha` bytes and an `rts` somewhere in the window.
//
// The measured pre-fix report for this payload, at the round-3 verification:
// `reachedAsInstruction=31`, `tableEntry=16`, `splitTables=1`, and eight
// `provenDispatchTargets` at $0840..$0847, with `classAt($0840)` reading
// "reached-as-instruction" over a cleared `nop` buffer. Forty-seven of 64 bytes
// claimed as code-or-table out of a 15-byte program, silently.
//
// `assertNoIndirectJumpOpcode()` and `assertCarriesPushIdiom()` below are what
// make this pair's two defining properties CHECKED FACTS rather than claims in
// this comment: nothing in the image can dispatch through the reconstructed
// tables, and the push idiom the gate rules on is genuinely present. The second
// throw matters as much as the first -- a future edit that removed the `pha`
// bytes would leave a fixture that brackets the gate from the OUTSIDE while
// still wearing an interior control's label, which is exactly the defect an
// interior control exists to prevent.
//
// FP3b is the immediate twin supplying FP3's MEASURED census baseline, for the
// reason FP1b and FP2b exist: a lone fixture asserting `reached <= code_size`
// is satisfied by an instrument that has quietly stopped censusing anything.
// ---------------------------------------------------------------------------

/** `lda $0830,x : sta $fb : lda $0838,x : sta $fc : pha : txa : pha : tya :
 * rts` -- the blocker payload verbatim. Each paired load is consumed by a
 * STORE, not by a push; the two pushes carry the accumulator's leftover value
 * and the X register. */
const FP3_INDEXED_PROLOGUE = [
  0xbd, 0x30, 0x08, // $0810 lda $0830,x   (lo table)
  0x85, 0xfb, //       $0813 sta $fb       (vector lo)
  0xbd, 0x38, 0x08, // $0815 lda $0838,x   (hi table)
  0x85, 0xfc, //       $0818 sta $fc       (vector hi)
  0x48, //             $081A pha
  0x8a, //             $081B txa
  0x48, //             $081C pha
  0x98, //             $081D tya
  0x60, //             $081E rts
];

/** `lda #$30 : nop : sta $fb : lda #$38 : nop : sta $fc : pha : txa : pha :
 * tya : rts` -- the immediate twin.
 *
 * The same zero-page vector is still constructed at `$fb`/`$fc` and the same
 * `pha`/`txa`/`pha`/`tya`/`rts` tail is retained; the ONLY difference is the
 * source of the two vector bytes, which changes from an indexed table read to
 * an immediate constant. Padded with `nop` so the prologue length is
 * unchanged, exactly as FP1b's and FP2b's are. */
const FP3_IMMEDIATE_PROLOGUE = [
  0xa9, 0x30, 0xea, // $0810 lda #$30 : nop
  0x85, 0xfb, //       $0813 sta $fb
  0xa9, 0x38, 0xea, // $0815 lda #$38 : nop
  0x85, 0xfc, //       $0818 sta $fc
  0x48, //             $081A pha
  0x8a, //             $081B txa
  0x48, //             $081C pha
  0x98, //             $081D tya
  0x60, //             $081E rts
];

/** The real code size of both push-idiom payloads, DERIVED from the prologue
 * rather than typed as a bare number, so the non-inflation control cannot
 * drift away from the payloads it guards. */
const FP3_CODE_SIZE = FP3_INDEXED_PROLOGUE.length;

const UNLINKED_PUSH_IDIOM = withZeroPageVectorData(FP3_INDEXED_PROLOGUE, [
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $081F filler
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0827 filler
  0xea, //                                           $082F filler
  0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, // $0830 lo bytes
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $0838 hi bytes
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0840 reconstructed targets
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0848
]);

const IMMEDIATE_PUSH_IDIOM = withZeroPageVectorData(FP3_IMMEDIATE_PROLOGUE, [
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $081F filler
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0827 filler
  0xea, //                                           $082F filler
  0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, // $0830 lo bytes
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, // $0838 hi bytes
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0840 reconstructed targets
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $0848
]);

// The push-idiom pair's stated properties, ENFORCED, in the same order the FP2
// pair enforces its own: pair length first, then the 64-byte size, then the
// prologue length, then the two defining properties, then the identical tail.
if (UNLINKED_PUSH_IDIOM.length !== IMMEDIATE_PUSH_IDIOM.length) {
  throw new Error(
    `the push-idiom pair must be EQUAL IN LENGTH -- UNLINKED_PUSH_IDIOM is ${UNLINKED_PUSH_IDIOM.length} bytes and ` +
      `IMMEDIATE_PUSH_IDIOM is ${IMMEDIATE_PUSH_IDIOM.length}; comparing their censuses is meaningless unless they differ ONLY in the code prologue`,
  );
}

for (const [name, payload] of [
  ["UNLINKED_PUSH_IDIOM", UNLINKED_PUSH_IDIOM],
  ["IMMEDIATE_PUSH_IDIOM", IMMEDIATE_PUSH_IDIOM],
]) {
  if (payload.length !== 0x40) {
    throw new Error(`${name} must be exactly 64 bytes, got ${payload.length}`);
  }
}

if (FP3_INDEXED_PROLOGUE.length !== FP3_CODE_SIZE || FP3_IMMEDIATE_PROLOGUE.length !== FP3_CODE_SIZE) {
  throw new Error(
    `both push-idiom prologues must be exactly FP3_CODE_SIZE (${FP3_CODE_SIZE}) bytes -- indexed is ` +
      `${FP3_INDEXED_PROLOGUE.length}, immediate is ${FP3_IMMEDIATE_PROLOGUE.length}; the declared code size is what the census is ` +
      `asserted not to exceed, so it may not be a number that is true of only one of the two`,
  );
}

// THE PROPERTY THE BLOCKER PAYLOAD TURNS ON, made a checked fact. This pair
// may NOT be passed to `assertDispatchesNowhere()` -- it exists precisely
// because it CARRIES the push idiom, so a throw on `$48` would be a throw on
// the fixture's whole reason for existing. The two properties are therefore
// split and each is enforced on its own.
//
// `assertNoIndirectJumpOpcode()` is the half that says nothing in the image
// dispatches through these tables: `$6c` is `jmp (indirect)`, and its absence
// ANYWHERE in the image -- not merely in the decoded prefix -- is what makes
// that statement true of the whole payload rather than of the part a decode
// happened to walk.
function assertNoIndirectJumpOpcode(name, payload) {
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === 0x6c) {
      throw new Error(
        `${name} must carry NO indirect-jump opcode, but has $6c at offset ${i} ($${(ORIGIN + i).toString(16)}) -- ` +
          `$6c is jmp (indirect), and one anywhere in the image makes this fixture unable to hold down the property it exists for: ` +
          `that a reconstructed lo/hi table pair NOTHING dispatches through is not proven dispatch`,
      );
    }
  }
}

// The other half, and the INTERIOR one. Without it a future edit could delete
// the `pha`/`pha`/`rts` idiom and leave a payload that never enters the region
// the class-3 push-idiom branch rules on -- an outside-bracketing control
// wearing an interior label, which is the defect this pair was authored to
// eliminate. Checked inside the prologue rather than over the whole image, so
// a stray data byte cannot satisfy it.
function assertCarriesPushIdiom(name, payload, codeSize) {
  const prologue = payload.subarray(0, codeSize);
  let pushes = 0;
  let returns = 0;
  for (const byte of prologue) {
    if (byte === 0x48) pushes++;
    if (byte === 0x60) returns++;
  }
  if (pushes < 2 || returns < 1) {
    throw new Error(
      `${name} must CARRY the stack-return push idiom inside its ${codeSize}-byte prologue, but has ${pushes} $48 (pha) byte(s) ` +
        `and ${returns} $60 (rts) byte(s) -- at least two pushes and one return are required. A payload without the idiom never ` +
        `enters the region the class-3 push-idiom branch rules on, so it would bracket that branch from the OUTSIDE while still ` +
        `being declared its interior control`,
    );
  }
}

assertNoIndirectJumpOpcode("UNLINKED_PUSH_IDIOM", UNLINKED_PUSH_IDIOM);
assertNoIndirectJumpOpcode("IMMEDIATE_PUSH_IDIOM", IMMEDIATE_PUSH_IDIOM);
assertCarriesPushIdiom("UNLINKED_PUSH_IDIOM", UNLINKED_PUSH_IDIOM, FP3_CODE_SIZE);
assertCarriesPushIdiom("IMMEDIATE_PUSH_IDIOM", IMMEDIATE_PUSH_IDIOM, FP3_CODE_SIZE);

for (let i = FP3_CODE_SIZE; i < UNLINKED_PUSH_IDIOM.length; i++) {
  if (UNLINKED_PUSH_IDIOM[i] !== IMMEDIATE_PUSH_IDIOM[i]) {
    throw new Error(
      `the push-idiom pair must be BYTE-IDENTICAL from offset ${FP3_CODE_SIZE} onward -- they differ at offset ${i} ` +
        `($${(ORIGIN + i).toString(16)}): indexed has $${UNLINKED_PUSH_IDIOM[i].toString(16).padStart(2, "0")}, immediate has ` +
        `$${IMMEDIATE_PUSH_IDIOM[i].toString(16).padStart(2, "0")}. "Differing ONLY in addressing mode" is a CHECKED property of ` +
        `these fixtures, not a claim in a comment`,
    );
  }
}

const ADDR = { entry: 0x0810, setFlag: 0x0820, readTable: 0x0828, tailCall: 0x0830 };

const CROSS_REFERENCES = [
  { address: 0x0810, callers: [] },
  { address: 0x0820, callers: [0x0810, 0x0816] },
  { address: 0x0828, callers: [0x0813] },
  { address: 0x0830, callers: [0x081c] },
];

const HONEST_BLOCKS = [
  { start_address: 0x0810, end_address: 0x083f, type: "Code" },
  { start_address: 0x0840, end_address: 0x084f, type: "Byte" },
];

const ALL_DATA_BLOCKS = [{ start_address: 0x0810, end_address: 0x084f, type: "Byte" }];

const USER_NAMES = {
  [ADDR.entry]: "entry_point",
  [ADDR.setFlag]: "set_flag",
  [ADDR.readTable]: "read_table",
  [ADDR.tailCall]: "tail_call",
};

// Auto names use upstream's own `LabelType::prefix()` spellings (`s_` for
// Subroutine). Note `L_` never appears here: upstream shares it between
// predefined and user-defined label types, so it cannot distinguish auto from
// user and the instrument deliberately excludes it.
const AUTO_NAMES = {
  [ADDR.entry]: "s_0810",
  [ADDR.setFlag]: "s_0820",
  [ADDR.readTable]: "s_0828",
  [ADDR.tailCall]: "s_0830",
};

const LABEL_TYPES = {
  [ADDR.entry]: "Subroutine",
  [ADDR.setFlag]: "Subroutine",
  [ADDR.readTable]: "Subroutine",
  [ADDR.tailCall]: "Jump",
};

function symbols(names, kind) {
  return Object.keys(names)
    .map(Number)
    .sort((a, b) => a - b)
    .map((address) => ({ address, name: names[address], kind, type: LABEL_TYPES[address] }));
}

/** The well-documented control's comments: distinct, graded, and -- for the
 * two-caller label at $0820 -- literally naming one of its callers. */
const GOOD_COMMENTS = [
  { address: ADDR.entry, type: "line", comment: "[confirmed-code] entry point: calls set_flag, then read_table, then tails into tail_call" },
  { address: ADDR.setFlag, type: "line", comment: "[confirmed-code] sets the mode flag; reached from $0810 and from $0816" },
  { address: ADDR.readTable, type: "line", comment: "[probable-code] reads the sixteen-byte value table at $0840 indexed by X" },
  { address: ADDR.tailCall, type: "line", comment: "[confirmed-code] tail: loads the final mode byte and returns to the caller" },
];

/** As above, except the two-caller label's comment names NO caller. Every
 * other measure stays clean, so only the cross-reference rule can catch it. */
const UNNAMED_CALLER_COMMENTS = GOOD_COMMENTS.map((c) =>
  c.address === ADDR.setFlag
    ? { address: c.address, type: "line", comment: "[confirmed-code] sets the mode flag before the main loop runs" }
    : c,
);

/** Every line comment identical, and equal to a banned-generic entry. */
const GENERIC_COMMENTS = GOOD_COMMENTS.map((c) => ({ address: c.address, type: "line", comment: "handles data" }));

const FIXTURES = [
  {
    dir: "nc1-all-auto",
    control: "NC1",
    purpose: "every label is kind Auto with its auto name intact",
    expect_clean: false,
    expect_measure: "labels",
    symbols: symbols(AUTO_NAMES, "Auto"),
    comments: GOOD_COMMENTS,
    blocks: HONEST_BLOCKS,
  },
  {
    dir: "nc1b-auto-renamed-in-place",
    control: "NC1b",
    purpose: "every label flipped to kind User with its auto name UNCHANGED -- the kind figure looks perfect, the name figure does not",
    expect_clean: false,
    expect_measure: "labels",
    symbols: symbols(AUTO_NAMES, "User"),
    comments: GOOD_COMMENTS,
    blocks: HONEST_BLOCKS,
  },
  {
    dir: "nc2-generic-comments",
    control: "NC2",
    purpose: "every line comment identical and generic",
    expect_clean: false,
    expect_measure: "commentVacuity",
    symbols: symbols(USER_NAMES, "User"),
    comments: GENERIC_COMMENTS,
    blocks: HONEST_BLOCKS,
  },
  {
    dir: "nc3-all-data-blocks",
    control: "NC3",
    purpose: "every byte set to a data type while the code is real -- the census must not move, the divergence must",
    expect_clean: false,
    expect_measure: "divergence",
    symbols: symbols(USER_NAMES, "User"),
    comments: GOOD_COMMENTS,
    blocks: ALL_DATA_BLOCKS,
  },
  {
    dir: "nc4-multi-caller-unnamed",
    control: "NC4",
    purpose: "the two-caller label at $0820 is documented without naming either caller",
    expect_clean: false,
    expect_measure: "reproducibility",
    symbols: symbols(USER_NAMES, "User"),
    comments: UNNAMED_CALLER_COMMENTS,
    blocks: HONEST_BLOCKS,
  },
  {
    dir: "nc5-well-documented",
    control: "NC5",
    purpose: "the FALSE-POSITIVE control: a genuinely well-documented program that must produce a CLEAN result. Without this one the whole instrument is vacuous",
    expect_clean: true,
    expect_measure: null,
    symbols: symbols(USER_NAMES, "User"),
    comments: GOOD_COMMENTS,
    blocks: HONEST_BLOCKS,
  },
  {
    dir: "fp1-indexed-copy-loop",
    control: "FP1",
    purpose:
      "the CENSUS false-positive control, NOT a findings control: an ordinary two-table indexed copy loop that dispatches through nothing. The property under test is that structural.reachedAsInstruction does not exceed code_size; the clean/non-clean verdict is INCIDENTAL and expect_measure is deliberately null",
    program: INDEXED_COPY_LOOP,
    code_size: FP_CODE_SIZE,
    expect_clean: false,
    expect_measure: null,
    symbols: [],
    comments: [],
    blocks: [],
    cross_references: [],
  },
  {
    dir: "fp1b-immediate-copy-loop",
    control: "FP1b",
    purpose:
      "the twin of FP1 whose ONLY difference is the addressing mode of its two loads. It is committed rather than inferred so FP1's census can be compared against a measured baseline instead of against a remembered number -- a remembered number being exactly what a control fixture exists to replace",
    program: IMMEDIATE_COPY_LOOP,
    code_size: FP_CODE_SIZE,
    expect_clean: false,
    expect_measure: null,
    symbols: [],
    comments: [],
    blocks: [],
    cross_references: [],
  },
  {
    dir: "fp2-zeropage-data-pointer",
    control: "FP2",
    purpose:
      "the dispatch gate's INTERIOR control. FP1/FP1b and the positive SPLIT_TABLE bracket the gate from the OUTSIDE -- FP1 carries no zero-page store at all and SPLIT_TABLE carries a real jmp ($00fb) -- so nothing exercised the interior: a vector that IS genuinely built and then consumed by something other than a jump. This payload satisfies every condition the pre-CR-04 gate required (two indexed loads through the same register, two stores into consecutive zero-page addresses inside the pairing window, a resolvable lo/hi orientation, and eight reconstructed targets that each decode) while dispatching NOWHERE -- it consumes its vector with lda ($fb),y, an indirect-indexed DATA read, the most ordinary 16-bit pointer idiom on a 6502. The property under test is that dispatch.splitTables, provenDispatchTargets() and dispatch.tableEntryAddresses are ALL empty and classAt($0840) is unreached. Pre-fix this reported splitTables=1, eight proven targets at $0840..$0847, sixteen claimed table-entry bytes and reached=33 against a declared code_size of 17",
    program: ZEROPAGE_DATA_POINTER,
    code_size: FP2_CODE_SIZE,
    expect_clean: false,
    expect_measure: null,
    symbols: [],
    comments: [],
    blocks: [],
    cross_references: [],
  },
  {
    dir: "fp2b-immediate-data-pointer",
    control: "FP2b",
    purpose:
      "the twin of FP2 whose ONLY difference is the addressing mode of its two vector-byte loads -- immediate constants instead of indexed table reads. The same zero-page vector is still built at $fb/$fc and still consumed by the same lda ($fb),y. It is committed rather than inferred so FP2's census is compared against a LIVE, MEASURED baseline instead of against a number someone remembered: the two must report the SAME structural.reachedAsInstruction, and the twin's must be strictly greater than zero, so the equality cannot be satisfied by an instrument that quietly stopped censusing anything. Pre-fix the pair was asymmetric -- 33 against 17, on 17 bytes of real code in both",
    program: IMMEDIATE_DATA_POINTER,
    code_size: FP2_CODE_SIZE,
    expect_clean: false,
    expect_measure: null,
    symbols: [],
    comments: [],
    blocks: [],
    cross_references: [],
  },
  {
    dir: "fp3-unlinked-push-idiom",
    control: "FP3",
    purpose:
      "the CLASS-3 push-idiom route's INTERIOR control. FP2 reaches the zero-page-vector shape's interior and the three STACK_RETURN payloads reach the push idiom through the CLASS-4 five-instruction window, so the class-3 route into the push idiom had no control at all. This payload takes it: lda $0830,x : sta $fb : lda $0838,x : sta $fc : pha : txa : pha : tya : rts, fifteen bytes of code with NO $6c byte anywhere in the image. Class 4 declines the window outright because its second instruction is a store rather than a push, and the class-3 pass then ruled on the pairing with only two $48 bytes and a $60 byte somewhere in reach as its evidence -- pushes that carry the accumulator's leftover value and the X register, NEITHER of which is a byte the two paired loads supplied. The property under test is that dispatch.splitTables, provenDispatchTargets() and dispatch.tableEntryAddresses are ALL empty, classAt($0840) is unreached, the census equals the declared 15 code bytes, and the pairing is STILL reported as exactly one advisory candidate so the gate demonstrably examined and declined it. Pre-fix this reported reached=31, tableEntry=16, splitTables=1 and eight proven targets at $0840..$0847",
    program: UNLINKED_PUSH_IDIOM,
    code_size: FP3_CODE_SIZE,
    expect_clean: false,
    expect_measure: null,
    symbols: [],
    comments: [],
    blocks: [],
    cross_references: [],
  },
  {
    dir: "fp3b-immediate-push-idiom",
    control: "FP3b",
    purpose:
      "the twin of FP3 whose ONLY difference is the addressing mode of its two vector-byte loads -- immediate constants instead of indexed table reads. The same zero-page vector is still built at $fb/$fc and the same pha : txa : pha : tya : rts tail is retained, so the push idiom is present in both and only the indexed pairing is gone. It is committed rather than inferred so FP3's census is compared against a LIVE, MEASURED baseline instead of against a number someone remembered: the two must report the SAME structural.reachedAsInstruction, that value must equal the 15 code bytes the twin's own store declares, and the twin must report ZERO advisory candidates because it has no indexed pair for the gate to rule on. Pre-fix the pair was asymmetric -- 31 against 15, on 15 bytes of real code in both",
    program: IMMEDIATE_PUSH_IDIOM,
    code_size: FP3_CODE_SIZE,
    expect_clean: false,
    expect_measure: null,
    symbols: [],
    comments: [],
    blocks: [],
    cross_references: [],
  },
];

function writeFixture(fixture) {
  const dir = join(HERE, fixture.dir);
  mkdirSync(dir, { recursive: true });

  // The five findings controls share `PROGRAM`; the false-positive pair each
  // carries its own. `?? PROGRAM` keeps the shared-program guarantee for
  // everything that does not opt out explicitly.
  const program = fixture.program ?? PROGRAM;

  writeFileSync(join(dir, "project.regen2000proj"), synthesizeProject(program, { origin: ORIGIN }));

  const store = {
    control: fixture.control,
    purpose: fixture.purpose,
    origin: ORIGIN,
    size: program.length,
    // Only the false-positive pair declares a code size. The census assertion
    // reads it FROM THE FIXTURE, so the number the census may not exceed is
    // the fixture's own declaration rather than a constant typed into a test.
    ...(fixture.code_size === undefined ? {} : { code_size: fixture.code_size }),
    expect_clean: fixture.expect_clean,
    expect_measure: fixture.expect_measure,
    symbols: fixture.symbols,
    comments: fixture.comments,
    blocks: fixture.blocks,
    cross_references: fixture.cross_references ?? CROSS_REFERENCES,
  };
  writeFileSync(join(dir, "store.json"), `${JSON.stringify(store, null, 2)}\n`);
}

for (const fixture of FIXTURES) writeFixture(fixture);

console.log(`make-coverage-fixtures: wrote ${FIXTURES.length} control fixtures under ${HERE}`);
