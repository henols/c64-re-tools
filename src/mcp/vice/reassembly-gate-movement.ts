// reassembly-gate-movement.ts -- relocates one symbol at the store-document
// and image layer, so the reassembly gate exercises a MOVED layout on every
// run rather than only ever reassembling at the addresses a subject was
// decompiled from.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// Symbolising every reference is only worth something if code can actually
// move. A rebuild that only ever reassembles a program at its original
// addresses proves the bytes round-trip, not that the source is movable, and
// nothing in this codebase relocated a symbol in place before this file --
// every prior test built a fresh subject at a fresh address instead. This
// module relocates a chosen symbol's label, its owning range and its
// containing scope by one delta, rebuilds the program image at the new
// layout, and patches the reference sites a caller declares -- so the same
// export path and the same real assembler that would run on an unmoved
// subject run on a moved one too.
//
// The relocation happens to the STORE DOCUMENT AND THE IMAGE TOGETHER, never
// as a text splice of already-generated assembly: editing emitted source
// would stop exercising the export path that is the thing under test. And the
// reference sites a relocation patches are a DECLARED input of the request,
// never derived from the exporter's own symbolisation -- deriving them would
// re-implement the exporter's symbol resolution inside the very check meant
// to test it.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Turning one relocation request (a store export document, an image, the
// symbol to move, a signed delta and a declared reference-site list) into a
// relocated subject a real exporter and a real assembler can run against, or
// a named refusal when the request cannot be honoured honestly.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never make the relocation optional, conditional on a flag, or skipped
//     when a subject looks hard to relocate. A subject this transform cannot
//     relocate throws a named refusal; it never falls back to reassembling
//     the unmoved layout and calling that a movement pass.
//   - Never derive `sites` from the exporter's own symbolisation. The sites
//     are a declared input of the request -- fixture data -- never re-derived
//     inside this module.
//   - Never patch a declared site whose current bytes do not already hold the
//     symbol's ORIGINAL address. A stale or wrong site declaration would
//     silently patch bytes that are not an address at all, and the resulting
//     rebuild would be wrong in a way a byte-diff would blame on the
//     exporter rather than on the fixture. Refused by name, never repaired.
//   - Never patch the image in place. Patching in place would leave the moved
//     bytes at both the old and the new address and could silently overwrite
//     a neighbouring range; this module always rebuilds a fresh buffer and
//     copies each range to its own new address.
//   - Never spawn a child process, read emitted assembly text, or compare
//     produced bytes against expected bytes here. This module is a pure
//     transform over a document and an image; the real export and the real
//     assembler run are a later step's job.
//   - Never carry this project's own planning bookkeeping in this file. It is
//     test-only today, but a consumer reading it has no planning tree to
//     resolve a citation against, and the reason for every rule here is
//     stated in words instead.
import type { AcmeOutcome } from "./acme-verify.ts";
import type { MovementOutcome, MovementResult } from "./reassembly-gate.ts";
import type { StoreExportDocument, StoreExportRangeRow, StoreExportScopeRow } from "./anno-store-export.ts";

/**
 * The three ways a declared reference site holds an address, and there are
 * exactly three. Declared as a frozen array so `RelocationSiteEncoding` is
 * DERIVED from it rather than a second, hand-typed union that could drift
 * from the runtime list this module actually switches on.
 */
export const RELOCATION_SITE_ENCODINGS = Object.freeze(["twoByteLittleEndian", "lowByte", "highByte"] as const);
export type RelocationSiteEncoding = (typeof RELOCATION_SITE_ENCODINGS)[number];

/**
 * One declared reference site: an address inside the image, the way that
 * address holds a target, and the symbol name whose address it is expected
 * to hold BEFORE the relocation runs. A caller declares every site a
 * relocation must patch -- this module never discovers one on its own.
 */
export interface RelocationSite {
  address: number;
  encoding: RelocationSiteEncoding;
  symbolName: string;
}

/**
 * One relocation request: the store export document and the image it
 * annotates, the image's own origin address, the symbol to move, the signed
 * delta to move it by, and the declared reference-site list to patch.
 */
export interface RelocationRequest {
  document: StoreExportDocument;
  image: Uint8Array;
  /** First address `image` covers. */
  origin: number;
  symbolName: string;
  /** Signed distance to move `symbolName` by, in bytes. A delta of `0` is
   * refused -- see `relocateSubject()`'s own first check. */
  delta: number;
  sites: readonly RelocationSite[];
}

/**
 * The result of a successful relocation: the transformed document, the
 * rebuilt image and its own new origin, the symbol that moved and its
 * original and relocated addresses, the delta, and the sites that were
 * patched. `symbolName` is carried here (not just on the request) because
 * `buildMovementResult()` below needs it to build a `MovementResult` without
 * a second lookup back into the transformed document.
 */
export interface RelocatedSubject {
  document: StoreExportDocument;
  image: Uint8Array;
  origin: number;
  symbolName: string;
  originalAddress: number;
  relocatedAddress: number;
  delta: number;
  sites: readonly RelocationSite[];
}

function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

function hexForEncoding(value: number, encoding: RelocationSiteEncoding): string {
  return encoding === "twoByteLittleEndian" ? hex4(value) : `$${(value & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
}

/** The value a declared site's own bytes are expected to encode, given the
 * address it is declared to hold and its own encoding. */
function expectedSiteValue(address: number, encoding: RelocationSiteEncoding): number {
  if (encoding === "twoByteLittleEndian") return address & 0xffff;
  if (encoding === "lowByte") return address & 0xff;
  return (address >> 8) & 0xff;
}

/** Reads what a declared site's bytes CURRENTLY hold, from `image` (whose
 * first byte is at `origin`), under the site's own encoding. */
function readSiteValue(image: Uint8Array, origin: number, address: number, encoding: RelocationSiteEncoding): number {
  const offset = address - origin;
  if (encoding === "twoByteLittleEndian") {
    const low = image[offset] ?? 0;
    const high = image[offset + 1] ?? 0;
    return low | (high << 8);
  }
  return image[offset] ?? 0;
}

/** Writes `address` into `buffer` at `offset`, under `encoding`. A two-byte
 * site is written low octet first, matching every ACME `<name`/`>name`-paired
 * split-address table this project's exporter already emits. */
function writeSiteValue(buffer: Uint8Array, offset: number, encoding: RelocationSiteEncoding, address: number): void {
  if (encoding === "twoByteLittleEndian") {
    buffer[offset] = address & 0xff;
    buffer[offset + 1] = (address >> 8) & 0xff;
    return;
  }
  if (encoding === "lowByte") {
    buffer[offset] = address & 0xff;
    return;
  }
  buffer[offset] = (address >> 8) & 0xff;
}

/**
 * Relocates `request.symbolName` by `request.delta`: shifts its label row,
 * its owning range row and its containing scope row (if one exists) all by
 * the same delta, leaving every other row untouched; rebuilds the image at
 * the transformed document's own new extent; and patches every declared
 * reference site with the relocated address under its own encoding.
 *
 * Every dishonest request is refused BY NAME, before any row is shifted and
 * before any byte is copied:
 *   - a delta of `0` -- a same-address round trip exercises nothing about
 *     whether a MOVED layout still rebuilds;
 *   - an empty site list -- a relocation nothing points at cannot be told
 *     apart from a byte copy;
 *   - a symbol with no label row in the document;
 *   - a declared site naming a symbol other than the one being moved;
 *   - a declared site whose CURRENT bytes do not already hold the symbol's
 *     ORIGINAL address under its own encoding -- a site declaration that has
 *     drifted from the image would otherwise patch bytes that mean something
 *     else, and the resulting rebuild would be wrong in a way a byte-diff
 *     would blame on the exporter rather than on the stale fixture. Refused
 *     rather than repaired;
 *   - a relocation whose new range would intersect another range's extent.
 *     Two ranges that merely ABUT (one's exclusive end equals the other's
 *     start) do NOT intersect and are allowed; two that share even one
 *     address DO intersect and are refused -- an off-by-one here would
 *     silently permit an overwrite.
 */
export function relocateSubject(request: RelocationRequest): RelocatedSubject {
  const { document, image, origin, symbolName, delta, sites } = request;

  if (delta === 0) {
    throw new Error(
      `relocateSubject: relocation delta for symbol ${JSON.stringify(symbolName)} is 0 -- a same-address round trip exercises ` +
        `nothing about whether a MOVED layout still rebuilds, so it is refused as a movement rather than accepted as a degenerate one.`,
    );
  }
  if (sites.length === 0) {
    throw new Error(
      `relocateSubject: symbol ${JSON.stringify(symbolName)} declares zero reference sites -- a relocation nothing points at cannot ` +
        `be distinguished from a byte copy, so it is refused rather than performed silently.`,
    );
  }

  const originalLabel = document.labels.find((label) => label.name === symbolName);
  if (originalLabel === undefined) {
    throw new Error(`relocateSubject: symbol ${JSON.stringify(symbolName)} names no label this document holds.`);
  }

  for (const site of sites) {
    if (site.symbolName !== symbolName) {
      throw new Error(
        `relocateSubject: the declared reference site at ${hex4(site.address)} names symbol ${JSON.stringify(site.symbolName)}, not the ` +
          `symbol being moved (${JSON.stringify(symbolName)}) -- every declared site must point at the one symbol this relocation moves.`,
      );
    }
  }

  const originalAddress = originalLabel.address;
  const relocatedAddress = originalAddress + delta;

  // A stale or wrong site declaration would otherwise patch bytes that are
  // not an address at all -- refused here, before any row is shifted or any
  // byte copied, rather than repaired.
  for (const site of sites) {
    const held = readSiteValue(image, origin, site.address, site.encoding);
    const expected = expectedSiteValue(originalAddress, site.encoding);
    if (held !== expected) {
      throw new Error(
        `relocateSubject: the declared site at ${hex4(site.address)} (encoding ${site.encoding}) does not currently hold symbol ` +
          `${JSON.stringify(symbolName)}'s original address ${hex4(originalAddress)} -- it holds ${hexForEncoding(held, site.encoding)} ` +
          `instead. A site declaration that has drifted from the image would otherwise patch bytes that mean something else, and the ` +
          `resulting rebuild would be wrong in a way the byte-diff would blame on the exporter. Refused rather than repaired.`,
      );
    }
  }

  const rangeIndex = document.ranges.findIndex((range) => range.start <= originalAddress && originalAddress <= range.endInclusive);
  if (rangeIndex === -1) {
    throw new Error(`relocateSubject: symbol ${JSON.stringify(symbolName)}'s address ${hex4(originalAddress)} lies inside no declared range.`);
  }
  const originalRange = document.ranges[rangeIndex]!;
  const movedRange: StoreExportRangeRow = {
    ...originalRange,
    start: originalRange.start + delta,
    endInclusive: originalRange.endInclusive + delta,
  };

  // Collision check, over half-open extents (`endExclusive = endInclusive +
  // 1`). Two ranges that merely ABUT do not intersect and are allowed; two
  // that share a single address DO intersect and are refused.
  const movedEndExclusive = movedRange.endInclusive + 1;
  for (let i = 0; i < document.ranges.length; i++) {
    if (i === rangeIndex) continue;
    const other = document.ranges[i]!;
    const otherEndExclusive = other.endInclusive + 1;
    const intersects = movedRange.start < otherEndExclusive && other.start < movedEndExclusive;
    if (intersects) {
      throw new Error(
        `relocateSubject: relocating symbol ${JSON.stringify(symbolName)} by ${delta} would move its owning range to ` +
          `${hex4(movedRange.start)}..${hex4(movedRange.endInclusive)} (inclusive), which intersects another range at ` +
          `${hex4(other.start)}..${hex4(other.endInclusive)} (inclusive) -- refused rather than silently overwritten. Two ranges that ` +
          `merely abut are allowed; two that share even one address are not.`,
      );
    }
  }

  const scopeRows = document.scopes ?? [];
  const scopeIndex = scopeRows.findIndex((scope) => scope.start <= originalAddress && originalAddress <= scope.endInclusive);
  const movedScope: StoreExportScopeRow | undefined =
    scopeIndex === -1 ? undefined : { start: scopeRows[scopeIndex]!.start + delta, endInclusive: scopeRows[scopeIndex]!.endInclusive + delta };

  const transformedDocument: StoreExportDocument = {
    ...document,
    labels: document.labels.map((label) => (label.name === symbolName ? { ...label, address: relocatedAddress } : label)),
    ranges: document.ranges.map((range, i) => (i === rangeIndex ? movedRange : range)),
    scopes: document.scopes === undefined ? undefined : document.scopes.map((scope, i) => (i === scopeIndex && movedScope !== undefined ? movedScope : scope)),
  };

  // Rebuild the image from scratch, spanning the TRANSFORMED document's own
  // lowest range start to its highest range end, zero-filled. Each range's
  // bytes are copied out of the ORIGINAL image at that range's ORIGINAL
  // address into the new buffer at its NEW address -- a range that did not
  // move copies to the same place, and the address the moved range vacated
  // is simply never written, which is what the exporter's own gap handling
  // and ACME's plain output format both produce for an uncovered address.
  const newOrigin = Math.min(...transformedDocument.ranges.map((r) => r.start));
  const newHighestEnd = Math.max(...transformedDocument.ranges.map((r) => r.endInclusive));
  const newImage = new Uint8Array(newHighestEnd - newOrigin + 1);

  for (let i = 0; i < document.ranges.length; i++) {
    const before = document.ranges[i]!;
    const after = transformedDocument.ranges[i]!;
    const length = before.endInclusive - before.start + 1;
    const srcOffset = before.start - origin;
    const destOffset = after.start - newOrigin;
    for (let b = 0; b < length; b++) {
      newImage[destOffset + b] = image[srcOffset + b] ?? 0;
    }
  }

  // Patch each declared site LAST, in the rebuilt buffer: at the site's own
  // address shifted by `delta` when the site itself lies inside the range
  // that moved, unshifted otherwise.
  const insideMovedRange = (address: number): boolean => address >= originalRange.start && address <= originalRange.endInclusive;
  for (const site of sites) {
    const patchAddress = insideMovedRange(site.address) ? site.address + delta : site.address;
    writeSiteValue(newImage, patchAddress - newOrigin, site.encoding, relocatedAddress);
  }

  return {
    document: transformedDocument,
    image: newImage,
    origin: newOrigin,
    symbolName,
    originalAddress,
    relocatedAddress,
    delta,
    sites,
  };
}

/**
 * Builds the gate's `MovementResult` from a real assembler verdict and the
 * relocated subject that produced it. Carries the verdict's outcome, the
 * symbol, the delta and both addresses -- EXCEPT one rule of its own, applied
 * regardless of what the verdict said: when the original and relocated
 * addresses are equal, the outcome is `"refused"`. `relocateSubject()` above
 * already refuses a zero delta before a subject can exist, so this rule is
 * defence in depth for a `RelocatedSubject` assembled directly (a caller the
 * type system cannot stop from constructing one with equal addresses), on
 * exactly the same terms `reassembly-gate.ts`'s own `movementRebuildFromResult()`
 * already carries for the `MovementResult` layer above this one.
 */
export function buildMovementResult(verdict: AcmeOutcome, subject: RelocatedSubject): MovementResult {
  const sameAddress = subject.originalAddress === subject.relocatedAddress;
  const outcome: MovementOutcome = sameAddress ? "refused" : verdict;
  return {
    outcome,
    symbolName: subject.symbolName,
    relocationDelta: subject.delta,
    originalAddress: subject.originalAddress,
    relocatedAddress: subject.relocatedAddress,
    reason: sameAddress
      ? `buildMovementResult: original and relocated addresses are both ${hex4(subject.originalAddress)} -- a same-address round trip ` +
        `is refused as a movement pass whatever the assembler verdict ("${verdict}") carried.`
      : `buildMovementResult: assembler verdict "${verdict}" for symbol ${JSON.stringify(subject.symbolName)} relocated by ` +
        `${subject.delta} byte(s) from ${hex4(subject.originalAddress)} to ${hex4(subject.relocatedAddress)}.`,
  };
}

/**
 * The sibling refusal builder: a `MovementResult` carrying the refused
 * outcome and a reason string alone, for the case where `relocateSubject()`
 * itself threw before a subject could exist -- so there is no symbol, delta
 * or address pair to report.
 */
export function refusedMovement(reason: string): MovementResult {
  return {
    outcome: "refused",
    symbolName: null,
    relocationDelta: null,
    originalAddress: null,
    relocatedAddress: null,
    reason,
  };
}
