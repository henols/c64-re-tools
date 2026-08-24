#!/usr/bin/env node
// make-coverage-fixtures.mjs -- the reproducible generator for COV-02's six
// committed control fixtures.
//
// WHY A GENERATOR RATHER THAN SIX HAND-COMMITTED BLOBS: five of the six
// fixtures are the SAME 64-byte program with a different STORE attached. If
// each were hand-assembled, a change to the program would silently drift five
// controls apart from each other and the independence claim ("only the store
// differs") would stop being true without anything failing. Here the program
// is written once, below, and every fixture's project file is produced by
// this repository's own real `synthesizeProject()` -- never hand-assembled
// JSON -- so the payload format is the one the shipped writer emits.
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
];

function writeFixture(fixture) {
  const dir = join(HERE, fixture.dir);
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "project.regen2000proj"), synthesizeProject(PROGRAM, { origin: ORIGIN }));

  const store = {
    control: fixture.control,
    purpose: fixture.purpose,
    origin: ORIGIN,
    size: PROGRAM.length,
    expect_clean: fixture.expect_clean,
    expect_measure: fixture.expect_measure,
    symbols: fixture.symbols,
    comments: fixture.comments,
    blocks: fixture.blocks,
    cross_references: CROSS_REFERENCES,
  };
  writeFileSync(join(dir, "store.json"), `${JSON.stringify(store, null, 2)}\n`);
}

for (const fixture of FIXTURES) writeFixture(fixture);

console.log(`make-coverage-fixtures: wrote ${FIXTURES.length} control fixtures under ${HERE}`);
