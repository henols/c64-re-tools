#!/usr/bin/env node
// make-coverage-fixtures.mjs -- the reproducible generator for COV-02's eight
// committed control fixtures.
//
// WHY A GENERATOR RATHER THAN EIGHT HAND-COMMITTED BLOBS: the eight fixtures
// are two groups, and each group's defining property is a SAMENESS that only a
// generator can hold.
//
//   * The five findings controls (NC1..NC5) are the SAME 64-byte program with
//     a different STORE attached. If each were hand-assembled, a change to the
//     program would silently drift five controls apart from each other and the
//     independence claim ("only the store differs") would stop being true
//     without anything failing.
//   * The false-positive PAIR (FP1, FP1b) carries its own two programs, which
//     are byte-identical apart from a seven-byte code prologue -- one indexed,
//     one immediate. That only-difference-is-the-addressing-mode relationship
//     IS the fixture: comparing the census of the two is meaningless if they
//     differ anywhere else. Hand-committing them would let the relationship
//     drift silently, so the pair is generated TOGETHER and the generator
//     THROWS unless the two payloads are equal in length and byte-identical
//     from the end of the prologue onward.
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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { synthesizeProject } from "../../r2000-project.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

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
