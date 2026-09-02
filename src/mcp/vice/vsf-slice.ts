#!/usr/bin/env node
// vsf-slice.ts -- the ONE authoritative place in this repo holding VICE `.vsf`
// snapshot byte-layout knowledge: where the module table starts, how a module
// header is shaped, and how the `C64MEM` module's body splits into a 4-byte
// port/PLA prefix, the 65536-byte RAM array, and the 3-byte port-read suffix
// after it.
//
// This module performs NO filesystem and NO network I/O: every function takes
// bytes (`Uint8Array`) and returns values. Callers obtain the bytes
// themselves. That is the same claim `prg-image.ts` makes about itself, and a
// structural test in `vsf-slice.test.ts` asserts it from this module's own
// source rather than trusting this paragraph.
//
// WHY THIS FILE EXISTS: transcribing 64K out of a running machine as hex
// already lost data twice -- one 32 KB write truncated mid-payload, and one
// 8 KB write dropped ten characters, localised to `$7871`. Slicing the
// snapshot removes the transcription step outright rather than adding a
// checksum around it. It also removes a 4096-address exclusion: the `C64MEM`
// array is `mem_ram[]` -- RAM *under* I/O, not the register read view -- so
// `$D000-$DFFF` is not volatile on this route at all, which is the opposite
// of the rule that governs the memory-read route.
//
// THE ONE FACT THIS MODULE EXISTS TO GET RIGHT: a `.vsf` that is not read
// strictly does not fail loudly. It returns something 65536 bytes long that
// is not the machine's memory, and every number measured on top of it is then
// wrong with no diagnostic. So every refusal below is a deliverable, not
// error handling bolted on afterwards, and each one has a committed fixture
// under `fixtures/vsf/` observed to trigger it.
//
// THIS MODULE MUST BE LISTED IN `package.json`'s `files[]`. Two mechanical
// reasons: the skill-side route (`src/skills/c64-ram-capture/scripts/
// vsf-slice.mjs`) resolves this file inside the published tarball on the
// npm-installer route, and the structural census over `shippedTsModules()` is
// derived from `files[]`, so a module absent from that array is outside every
// structural guard's scanned set entirely.
//
// WHAT NOT TO DO:
//   - Never reach `C64MEM` by a fixed byte offset. The already-written
//     prototype at `.planning/phases/23-the-real-release-gate-go-degrade-no-go/
//     evidence/vsf-ram-extract.mjs` carries `first_module_offset = 37`, which
//     is stale: a SECOND magic block (`"VICE Version\x1a"`, 13 bytes, plus 4
//     version bytes plus a 4-byte SVN dword) follows the 16-byte machine
//     name, so the real first module offset is 58. Offset 37 lands inside
//     that second magic block, where the first "module" reads
//     `size = 1291845632`.
//   - Never carry that prototype's recovery path, which is the more dangerous
//     half. It survives the stale offset only by `off++`-rescanning for a
//     16-byte printable field followed by a plausible u32 length -- and such
//     a scan can lock onto a false module-name string inside 64 KB of RAM
//     data, then return a garbage 65536-byte image. The walk below advances
//     by the module's own size field and throws on the first malformed
//     header. `fixtures/vsf/malformed-header.vsf` is the positive control:
//     an implementation with a rescan fallback steps past it and keeps
//     walking, so that fixture slicing successfully means the fallback is
//     back.
//   - Never assert the `C64MEM` body is `4 + 65536` bytes. That arithmetic
//     (65540) refuses EVERY real snapshot: the measured body is 65555 at
//     module minor 1 and 65543 at minor 0, because VICE writes three port
//     read-back bytes after the RAM array and, at minor 1, two DWORD falloff
//     clocks plus four state bytes after those. The rule is `>= 65543`.
//   - Never take the CPU-visible `$0000`/`$0001` values from the 4-byte
//     PREFIX. The prefix is `(pport.data, pport.dir, EXROM, GAME)` -- data
//     first, address-swapped relative to the machine, where `$0000` is
//     direction and `$0001` is data -- and neither field is the CPU view
//     anyway. `zero_read()` returns `pport.dir_read` for `$0000` and
//     `pport.data_read` for `$0001`, and both of those live in the 3-byte
//     SUFFIX. Measured on one snapshot, three readings agreeing: prefix
//     `[231,47,0,0]` against suffix `[39,55,47]`, with the live registers on
//     that same snapshot giving `$00=47 $01=55`. A prefix-over-RAM copy
//     writes 231 where the CPU sees 47 -- wrong by 176, silently, at exactly
//     the two addresses the normalisation exists to fix.
//   - Never give any exported function a filesystem PATH parameter. They take
//     byte arrays, which is what keeps path traversal out of this module's
//     threat surface entirely rather than merely checked. Snapshot paths come
//     from `stock-paths.ts`'s `snapshotPathFor()`, which is confined inside
//     the workspace by construction. For the same reason this module imports
//     nothing from either of this repo's two host/container path-translation
//     seams; that absence is asserted structurally by
//     `hostpath-consumers.test.ts`, whose consumer set is a closed
//     five-member list.
//   - Never `subarray` on an unvalidated length. A short `subarray` silently
//     returns fewer bytes than asked for, which is the exact shape of the
//     failure this module exists to refuse.

/** The 19-byte leading magic. `SNAPSHOT_MAGIC_LEN` is 19 in VICE's own
 * source, and `.length` here is the arithmetic that produces it rather than
 * a second copy of the number. */
export const SNAPSHOT_MAGIC = "VICE Snapshot File\x1a";

/** `SNAPSHOT_MACHINE_NAME_LEN`. The name is NUL-padded to this width
 * (`"C64SC"` on an `x64sc` build). */
export const SNAPSHOT_MACHINE_NAME_LEN = 16;

/** The 13-byte SECOND magic block, which is the whole reason the first module
 * offset is 58 and not 37. */
export const SNAPSHOT_VERSION_MAGIC = "VICE Version\x1a";

/** Width of a module header's NUL-padded name field. Deliberately its OWN
 * constant and not `SNAPSHOT_MACHINE_NAME_LEN`: both are 16 in VICE's source,
 * but they are different fields in different structures, and sharing one
 * constant would make a future divergence in either look like a bug in the
 * other. */
export const MODULE_NAME_LEN = 16;

/** `name(16) major(1) minor(1) size(u32LE)`. Written as the arithmetic so the
 * 22 is checkable. The size field covers the module's OWN header as well as
 * its body. */
export const MODULE_HEADER_LEN = MODULE_NAME_LEN + 1 + 1 + 4;

/** Byte offset of the size field within a module header: the name field plus
 * the major and minor bytes. Evaluates to 18. */
export const MODULE_SIZE_FIELD_OFFSET = MODULE_NAME_LEN + 2;

/** Where the module table starts. Written as the arithmetic so the derivation
 * is checkable at a glance and cannot drift from the constants it is made of:
 * magic + snapshot major/minor + machine name + version magic + 4 VICE
 * version bytes + a 4-byte SVN dword. Evaluates to 58, which is where
 * `"MAINCPU"` was measured to begin on a genuine 3.9 snapshot. */
export const FIRST_MODULE_OFFSET =
  SNAPSHOT_MAGIC.length +
  2 +
  SNAPSHOT_MACHINE_NAME_LEN +
  SNAPSHOT_VERSION_MAGIC.length +
  4 +
  4;

/** Bytes of `(pport.data, pport.dir, EXROM, GAME)` ahead of the RAM array.
 * Deliberately NOT the normalisation source -- see the header. */
export const RAM_OFFSET = 4;

/** `C64_RAM_SIZE`, `0x10000`. */
export const RAM_SIZE = 65536;

/** The shortest `C64MEM` body this module accepts: the port/PLA prefix, the
 * RAM array, and the three port read-back bytes after it. Evaluates to 65543,
 * which is the measured body length at module minor 0. */
export const MIN_C64MEM_BODY_LEN = RAM_OFFSET + RAM_SIZE + 3;

/** The body length at module minor 1: the minor-0 body plus two DWORD port
 * falloff clocks and four port state bytes. Evaluates to 65555, the length
 * measured on a genuine 3.9 snapshot. */
export const V01_C64MEM_BODY_LEN = MIN_C64MEM_BODY_LEN + 4 + 4 + 4;

/** The module name this module slices, matched byte-exactly after trailing
 * NULs are stripped. Byte-exact matters: `"C64MEMHACKS"` is a real, adjacent
 * module in every genuine snapshot, and a `startsWith`/`includes` match would
 * find it. */
export const C64MEM_MODULE_NAME = "C64MEM";

/** Every refusal this module raises. Named rather than a bare `Error` so a
 * caller can tell "this snapshot is not readable" from a programming fault,
 * and so the skill-side CLI can pass the message through untouched instead of
 * inventing its own wording. */
export class VsfSliceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VsfSliceError";
  }
}

/** One entry of the module table. `size` is the module's own size field and
 * INCLUDES `MODULE_HEADER_LEN`; `bodyLength` is what is left after it. Both
 * are returned so a reader never has to remember which of the two a given
 * number is. */
export interface SnapshotModule {
  /** 16 bytes read as latin1 with trailing NULs stripped. */
  name: string;
  major: number;
  minor: number;
  /** Offset of the module HEADER within the file. */
  offset: number;
  /** The module's own u32LE size field, covering its 22-byte header. */
  size: number;
  /** `offset + MODULE_HEADER_LEN`. */
  bodyOffset: number;
  /** `size - MODULE_HEADER_LEN`. */
  bodyLength: number;
}

/** The result of slicing `C64MEM`: a flat 64K image plus the port bytes a
 * caller needs in order to normalise RAM `$0000`/`$0001` without re-reading
 * the snapshot. */
export interface C64MemSlice {
  /** Exactly `RAM_SIZE` bytes, copied out -- never a view into the input. */
  ram: Uint8Array;
  /** `pport.data_out`. Recorded for completeness; not a normalisation source. */
  dataOut: number;
  /** `pport.data_read` -- the CPU-visible value of `$0001`. */
  dataRead: number;
  /** `pport.dir_read` -- the CPU-visible value of `$0000`. */
  dirRead: number;
  /** The `C64MEM` MODULE's minor version (VICE's `SNAP_MINOR` for this
   * module), not the snapshot file header's minor. It is what distinguishes a
   * 65543-byte body from a 65555-byte one, so it is returned rather than left
   * for a caller to re-derive from `bodyLength`. */
  snapshotMinor: number;
  /** The observed body length: 65543 at minor 0, 65555 at minor 1. */
  bodyLength: number;
}

/** Reads a little-endian u32 without going through `Buffer`, so every
 * function here accepts a plain `Uint8Array` and the module needs no Node
 * import at all. `>>> 0` keeps a top-bit-set field unsigned, which matters
 * because a malformed size field is exactly the shape that sets it. */
function readU32LE(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
  );
}

/** Decodes a module name: 16 bytes latin1, trailing NULs stripped. Written as
 * a loop rather than a trailing-NUL regex so the stripping is visibly
 * TRAILING-only -- an embedded NUL is kept, because a name with one is
 * malformed and must not be silently normalised into a name that matches. */
function decodeModuleName(bytes: Uint8Array, at: number): string {
  let end = at + MODULE_NAME_LEN;
  while (end > at && bytes[end - 1] === 0) end--;
  let name = "";
  for (let i = at; i < end; i++) name += String.fromCharCode(bytes[i]);
  return name;
}

/** True iff `bytes` begins with `SNAPSHOT_MAGIC`. */
function hasSnapshotMagic(bytes: Uint8Array): boolean {
  if (bytes.length < SNAPSHOT_MAGIC.length) return false;
  for (let i = 0; i < SNAPSHOT_MAGIC.length; i++) {
    if (bytes[i] !== SNAPSHOT_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Walks the snapshot's module table STRICTLY, from `FIRST_MODULE_OFFSET`,
 * advancing by each module's own size field and never by one byte.
 *
 * Throws a `VsfSliceError` rather than recovering, at four points: an input
 * too short to hold a header plus one module header; a missing leading magic;
 * a module whose size field is below `MODULE_HEADER_LEN` or whose extent runs
 * past the end of the file; and -- after the loop -- a walk that did not end
 * EXACTLY at the file length.
 *
 * That last check is the cheapest whole-file integrity test available on this
 * format, and it is the one that would catch a future VICE adding a third
 * magic block loudly instead of silently: the modules would all still parse,
 * and the walk would simply stop somewhere other than the end.
 */
export function listSnapshotModules(bytes: Uint8Array): SnapshotModule[] {
  const minimum = FIRST_MODULE_OFFSET + MODULE_HEADER_LEN;
  if (bytes.length < minimum) {
    throw new VsfSliceError(
      `listSnapshotModules: input is ${bytes.length} byte(s) -- a .vsf needs at least ${minimum} ` +
        `(a ${FIRST_MODULE_OFFSET}-byte file header plus one ${MODULE_HEADER_LEN}-byte module header). ` +
        `Refusing rather than returning a short read.`,
    );
  }
  if (!hasSnapshotMagic(bytes)) {
    throw new VsfSliceError(
      `listSnapshotModules: input does not begin with the ${SNAPSHOT_MAGIC.length}-byte VICE ` +
        `snapshot magic -- refusing rather than guessing at the layout.`,
    );
  }

  const modules: SnapshotModule[] = [];
  let offset = FIRST_MODULE_OFFSET;

  while (offset + MODULE_HEADER_LEN <= bytes.length) {
    const name = decodeModuleName(bytes, offset);
    const major = bytes[offset + MODULE_NAME_LEN];
    const minor = bytes[offset + MODULE_NAME_LEN + 1];
    const size = readU32LE(bytes, offset + MODULE_SIZE_FIELD_OFFSET);

    if (size < MODULE_HEADER_LEN || offset + size > bytes.length) {
      throw new VsfSliceError(
        `listSnapshotModules: malformed module header at offset ${offset} ` +
          `(name=${JSON.stringify(name)}, major=${major}, minor=${minor}, size=${size}); a module ` +
          `size must be at least ${MODULE_HEADER_LEN} and must not run past the ${bytes.length}-byte ` +
          `file. Refusing rather than rescanning -- a byte-by-byte rescan can lock onto a false ` +
          `module name inside RAM data and return a garbage image.`,
      );
    }

    modules.push({
      name,
      major,
      minor,
      offset,
      size,
      bodyOffset: offset + MODULE_HEADER_LEN,
      bodyLength: size - MODULE_HEADER_LEN,
    });
    offset += size;
  }

  if (offset !== bytes.length) {
    throw new VsfSliceError(
      `listSnapshotModules: the module table walk ended at offset ${offset} but the file is ` +
        `${bytes.length} byte(s) -- the two must be equal. ${modules.length} module(s) parsed ` +
        `cleanly, so the geometry changed rather than the modules being malformed. Refusing rather ` +
        `than trusting a walk that did not account for the whole file.`,
    );
  }

  return modules;
}

/**
 * Slices the flat 64K RAM image out of the snapshot's `C64MEM` module body,
 * together with the three port read-back bytes that follow it.
 *
 * Zero `C64MEM` modules and two or more both throw -- a duplicated module
 * name is a malformed snapshot, never a first-wins situation. A body below
 * `MIN_C64MEM_BODY_LEN` throws naming both the observed length and the
 * minimum.
 */
export function sliceC64Mem(bytes: Uint8Array): C64MemSlice {
  const modules = listSnapshotModules(bytes);
  const matches = modules.filter((m) => m.name === C64MEM_MODULE_NAME);

  if (matches.length === 0) {
    const available = modules.map((m) => m.name).join(", ") || "(no modules)";
    throw new VsfSliceError(
      `sliceC64Mem: no module named "${C64MEM_MODULE_NAME}" found. Available modules: ${available}`,
    );
  }
  if (matches.length > 1) {
    throw new VsfSliceError(
      `sliceC64Mem: module name "${C64MEM_MODULE_NAME}" is duplicated -- ${matches.length} modules ` +
        `carry it (at offsets ${matches.map((m) => m.offset).join(", ")}). A duplicated module name ` +
        `is a malformed snapshot; refusing rather than taking the first.`,
    );
  }

  const c64mem = matches[0];
  if (c64mem.bodyLength < MIN_C64MEM_BODY_LEN) {
    throw new VsfSliceError(
      `sliceC64Mem: ${C64MEM_MODULE_NAME} body is ${c64mem.bodyLength} byte(s), need at least ` +
        `${MIN_C64MEM_BODY_LEN} (${RAM_OFFSET}-byte port prefix + ${RAM_SIZE} RAM + 3 port ` +
        `read-back bytes). Refusing a short read rather than returning a truncated image.`,
    );
  }

  const ramStart = c64mem.bodyOffset + RAM_OFFSET;
  const view = bytes.subarray(ramStart, ramStart + RAM_SIZE);
  // The length re-check makes "never subarray on an unvalidated length" true
  // by CONSTRUCTION rather than by the body-length check above happening to
  // imply it: a short `subarray` returns fewer bytes than asked for with no
  // error, and a short image is precisely what this module exists to refuse.
  if (view.length !== RAM_SIZE) {
    throw new VsfSliceError(
      `sliceC64Mem: the ${C64MEM_MODULE_NAME} RAM array at offset ${ramStart} is ${view.length} ` +
        `byte(s) inside a ${bytes.length}-byte file, not ${RAM_SIZE}. Refusing rather than ` +
        `returning a short image.`,
    );
  }
  // An explicit `new Uint8Array` + `set` and NOT `bytes.slice(...)`. Measured
  // while writing this module's own copy-independence test: `readFileSync`
  // returns a `Buffer`, and `Buffer.prototype.slice` overrides the TypedArray
  // method as an alias for `subarray` -- so `bytes.slice(...)` returns a VIEW
  // into the snapshot for exactly the input type every real caller passes.
  // A caller then normalising `$0000`/`$0001` would be writing into the
  // snapshot bytes, and the whole snapshot would stay alive behind a 64K
  // image.
  const ram = new Uint8Array(RAM_SIZE);
  ram.set(view);
  const suffix = ramStart + RAM_SIZE;

  return {
    ram,
    dataOut: bytes[suffix],
    dataRead: bytes[suffix + 1],
    dirRead: bytes[suffix + 2],
    snapshotMinor: c64mem.minor,
    bodyLength: c64mem.bodyLength,
  };
}
