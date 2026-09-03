#!/usr/bin/env node
// make-fixtures.mjs -- the ONE generator for every `.vsf` fixture under this
// directory, and the command each fixture's provenance sidecar names.
//
// WHY A GENERATOR AND NOT FOUR COMMITTED BLOBS WITH NO PRODUCER: three of the
// four fixtures are ~64 KB of byte-layout, and the interesting facts about
// them are arithmetic (a body of exactly 65543 versus exactly 65542, a module
// size field of exactly 21). A blob with no producer cannot be re-derived, so
// a reader has no way to check that the "one below the minimum" fixture really
// is one below the minimum rather than one above it. The sidecars declare
// `"synthetic": true` and name this file, so the provenance claim is checkable
// rather than asserted. Provenance that lies is the thing not to produce.
//
// THESE ARE SYNTHETIC, AND SAY SO. They are NOT captures of a real emulator.
// Their LAYOUT is modelled byte-for-byte on the measured layout of a genuine
// VICE 3.9 snapshot (`33-RESEARCH.md` M5: first module offset 58, 22-byte
// module header with the size field as u32LE at header offset 18 covering the
// header itself, `C64MEM` body 65555 at module minor 1 and 65543 at minor 0,
// port prefix `[231,47,0,0]` against the 3-byte suffix `[39,55,47]`). Their
// CONTENTS are a recomputable pattern, deliberately, so a test can assert the
// slice returned the RAM array and not the 4-byte prefix.
//
// WHAT NOT TO DO:
//   - Never hand-edit a `.vsf` or a `.json` in this directory. Change this
//     file and re-run it; a hand-patched fixture whose sidecar still names
//     this generator is a provenance lie.
//   - Never make a fixture's numbers depend on the clock, the host or a
//     random source. Re-running this generator must produce byte-identical
//     output apart from the sidecars' `capturedAt`, which is why the RAM
//     patterns are closed-form functions of the index.
//   - Never add `fixtures/vsf` to `package.json`'s `files[]`. These are
//     test-support, the sibling `fixtures/binmon/` is deliberately excluded
//     for the same reason, and `scripts/check-npm-packages.mjs` fails a pack
//     that leaks a fixture.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// The measured header geometry. Kept as literals HERE (rather than imported
// from `vsf-slice.ts`) on purpose: a fixture generator that derives its bytes
// from the module under test can only ever agree with it, and the fixtures
// exist to catch that module drifting. This is the one place in the tree where
// a second copy of the layout is the point rather than the hazard.
const SNAPSHOT_MAGIC = "VICE Snapshot File\x1a"; // 19 bytes
const VERSION_MAGIC = "VICE Version\x1a"; // 13 bytes
const HEADER_LEN = 58; // 19 + 2 + 16 + 13 + 4 + 4
const MODULE_HEADER_LEN = 22; // name(16) major(1) minor(1) size(u32LE)

/** A snapshot file header: magic, snapshot major/minor, NUL-padded machine
 * name, the second magic block, four VICE version bytes and the SVN dword. */
function snapshotHeader({ major = 2, minor = 0, machine = "C64SC" } = {}) {
  const buf = Buffer.alloc(HEADER_LEN);
  buf.write(SNAPSHOT_MAGIC, 0, "latin1");
  buf[19] = major;
  buf[20] = minor;
  buf.write(machine, 21, "latin1"); // Buffer.alloc zeroed it, so this is NUL-padded
  buf.write(VERSION_MAGIC, 37, "latin1");
  buf[50] = 3;
  buf[51] = 9;
  buf[52] = 0;
  buf[53] = 0;
  buf.writeUInt32LE(0, 54);
  return buf;
}

/** One module: 16-byte NUL-padded name, major, minor, u32LE size COVERING the
 * 22-byte header, then the body. `sizeOverride` exists solely for the
 * malformed-header fixture, whose whole purpose is a size field that cannot
 * be a real module. */
function moduleBlock(name, major, minor, body, sizeOverride) {
  const buf = Buffer.alloc(MODULE_HEADER_LEN + body.length);
  buf.write(name, 0, "latin1");
  buf[16] = major;
  buf[17] = minor;
  buf.writeUInt32LE(sizeOverride ?? MODULE_HEADER_LEN + body.length, 18);
  body.copy(buf, MODULE_HEADER_LEN);
  return buf;
}

/** A closed-form RAM pattern, so a test recomputes it rather than storing a
 * copy. Chosen so that the first four bytes differ from the 4-byte port
 * prefix `[231,47,0,0]`: that difference is what makes "the slice is the RAM
 * array, not the prefix" an observable assertion. */
export function ramPattern(mul, add) {
  const ram = Buffer.alloc(65536);
  for (let i = 0; i < ram.length; i++) ram[i] = (i * mul + add) & 0xff;
  return ram;
}

const PORT_PREFIX = Buffer.from([231, 47, 0, 0]); // pport.data, pport.dir, EXROM, GAME
const PORT_SUFFIX = Buffer.from([39, 55, 47]); // data_out, data_read, dir_read
/** Module minor 1's four extra fields: two DWORD falloff clocks then four
 * state bytes. 4 + 4 + 4 = 12, which takes 65543 to 65555. */
const MINOR1_TAIL = Buffer.concat([
  (() => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(0x11223344, 0);
    return b;
  })(),
  (() => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(0x55667788, 0);
    return b;
  })(),
  Buffer.from([1, 0, 1, 0]),
]);

/** A small, plausible MAINCPU module: every fixture carries one, so the
 * malformed/short cases prove the walk reached a SECOND module rather than
 * failing on the first thing it read. */
const MAINCPU = () =>
  moduleBlock("MAINCPU", 1, 4, Buffer.from([0x31, 0xea, 0x00, 0x2f, 0x37, 0x01, 0x00, 0x00]));

/** A small trailing module, so the walk has to advance PAST `C64MEM` by its
 * size field and still land exactly on the file length. */
const GLUE = () => moduleBlock("GLUE", 1, 0, Buffer.from([0x01, 0x02, 0x03]));

function c64memBody({ minor, ram, shortBy = 0 }) {
  const parts = [PORT_PREFIX, ram, PORT_SUFFIX];
  if (minor === 1) parts.push(MINOR1_TAIL);
  const body = Buffer.concat(parts);
  return shortBy === 0 ? body : body.subarray(0, body.length - shortBy);
}

const FIXTURES = {
  "wellformed-minor1": {
    note:
      "A well-formed snapshot with a MAINCPU module, a C64MEM module at module minor 1 whose body is " +
      "exactly 65555 bytes (4-byte port prefix + 65536 RAM + 3-byte suffix + 12 bytes of minor-1 " +
      "fields), and a trailing GLUE module, with the strict module-table walk ending exactly at the " +
      "file length. RAM byte i is (i * 7 + 13) & 0xff, so the first four RAM bytes are 13,20,27,34 " +
      "and cannot be confused with the port prefix 231,47,0,0. Port suffix is data_out=39, " +
      "data_read=55, dir_read=47, matching the measured live reading.",
    build: () =>
      Buffer.concat([
        snapshotHeader(),
        MAINCPU(),
        moduleBlock("C64MEM", 0, 1, c64memBody({ minor: 1, ram: ramPattern(7, 13) })),
        GLUE(),
      ]),
  },
  "wellformed-minor0": {
    note:
      "A well-formed snapshot whose C64MEM module is at module minor 0: body exactly 65543 bytes " +
      "(4-byte port prefix + 65536 RAM + 3-byte suffix), with the four trailing minor-1 fields " +
      "absent. The 3-byte suffix EXISTS at minor 0 -- only the DWORD/state fields after it do not " +
      "-- which is what makes dataRead/dirRead available on this branch too. RAM byte i is " +
      "(i * 11 + 5) & 0xff, a different pattern from the minor-1 fixture so a test cannot pass by " +
      "reading the wrong file.",
    build: () =>
      Buffer.concat([
        snapshotHeader(),
        MAINCPU(),
        moduleBlock("C64MEM", 0, 0, c64memBody({ minor: 0, ram: ramPattern(11, 5) })),
        GLUE(),
      ]),
  },
  "malformed-header": {
    note:
      "A valid snapshot header and a valid MAINCPU module, then at offset 88 a module header whose " +
      "u32LE size field reads 21 -- below the 22-byte module header it is supposed to cover, so the " +
      "walk cannot advance by it. This is the POSITIVE CONTROL for the refusal: a slicer carrying an " +
      "increment-by-one rescan fallback would step past this header and keep walking, so this " +
      "fixture producing a successful slice means the fallback is present.",
    build: () =>
      Buffer.concat([
        snapshotHeader(),
        MAINCPU(),
        moduleBlock("C64MEM", 0, 1, Buffer.alloc(0), 21),
        Buffer.alloc(21, 0xaa),
      ]),
  },
  "short-c64mem": {
    note:
      "A well-formed module-table walk ending exactly at the file length, whose C64MEM body is 65542 " +
      "bytes -- exactly one below the 65543 minimum. The walk succeeds and the BODY-LENGTH refusal is " +
      "what has to fire, which is why the trailing GLUE module is present: this fixture must not be " +
      "refused for the wrong reason.",
    build: () =>
      Buffer.concat([
        snapshotHeader(),
        MAINCPU(),
        moduleBlock("C64MEM", 0, 0, c64memBody({ minor: 0, ram: ramPattern(11, 5), shortBy: 1 })),
        GLUE(),
      ]),
  },
};

const COMMAND = "node src/mcp/vice/fixtures/vsf/make-fixtures.mjs";

/** `main(names)` regenerates the named fixtures, or all four when given none.
 * The filter exists so a plan can land one fixture at a time without leaving
 * the other three sitting untracked in the working tree. */
function main(names) {
  const wanted = names.length > 0 ? names : Object.keys(FIXTURES);
  // Object.hasOwn, NOT `in` (33 review WR-04). `in` walks the prototype
  // chain, so `"toString" in FIXTURES` is true: `make-fixtures.mjs toString`
  // passed this validation, matched no entry in the Object.entries() loop
  // below, wrote nothing, printed nothing and EXITED 0 -- a silent pass on a
  // fixture name that does not exist, in the generator whose whole job is
  // checkable provenance.
  const unknown = wanted.filter((n) => !Object.hasOwn(FIXTURES, n));
  if (unknown.length > 0) {
    console.error(
      `make-fixtures: unknown fixture name(s) ${unknown.join(", ")} -- this generator has exactly ` +
        `four: ${Object.keys(FIXTURES).join(", ")}`,
    );
    return 1;
  }
  const capturedAt = new Date().toISOString();
  const selected = Object.entries(FIXTURES).filter(([n]) => wanted.includes(n));
  // Belt and braces on the same class of bug: even with own-key validation
  // above, a selection that matches nothing must be an ERROR, not a silent
  // exit 0. "Wrote nothing" and "wrote what you asked for" must never share
  // an exit code in a provenance generator.
  if (selected.length === 0) {
    console.error(
      `make-fixtures: the requested name(s) ${wanted.join(", ")} selected no fixture -- refusing rather than ` +
        `exiting 0 having written nothing. This generator has exactly four: ${Object.keys(FIXTURES).join(", ")}`,
    );
    return 1;
  }
  for (const [name, spec] of selected) {
    const bytes = spec.build();
    writeFileSync(join(HERE, `${name}.vsf`), bytes);
    writeFileSync(
      join(HERE, `${name}.json`),
      `${JSON.stringify(
        {
          capturedFrom: "synthetic:make-fixtures.mjs",
          viceVersion: "3.9.0.0 (layout modelled on the measured 3.9 snapshot, not captured from it)",
          capturedAt,
          command: COMMAND,
          synthetic: true,
          fileBytes: bytes.length,
          note: spec.note,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`wrote ${name}.vsf (${bytes.length} bytes) and ${name}.json`);
  }
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
