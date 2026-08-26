#!/usr/bin/env node
// Throwaway `dxa -a dump` column parser for phase 23 -- evidence, not a
// deliverable. This is the SINGLE listing parser this phase owns: every
// criterion-1 computation in 23-06 and 23-07 imports parseDumpListing() from
// here, and no second dxa listing parser is written anywhere in the phase.
//
// The line shape it reproduces is fixed, ahead of any measurement, by:
//
//   .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/SCHEMA.md
//     Section 6 "dxa flag set" -> "Listing parser":
//     Matches ^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$ -- a whitespace class,
//     NOT a literal tab, because `.word` lines are space-separated where
//     instruction lines are tab-separated. Classifies by whether the text
//     begins `.byt` or `.word`. Asserts the accounted byte total equals the
//     image size, refusing rather than under-counting on an unseen line shape.
//
//   .planning/phases/23-the-real-release-gate-go-degrade-no-go/23-RESEARCH.md
//     Section "Code Examples" -> "The `-a dump` classifier" -- the shape this
//     script reproduces.
//
// It deliberately does NOT import from any module under src/. Evidence
// convention 9 in evidence/README.md forbids this phase creating or modifying
// anything under src/, and a probe script is evidence, not a deliverable: it is
// registered in no manifest and nothing ships it. Phase 24's DXA-02 owns the
// real, tested implementation; this file is the throwaway that proves the shape
// works and produces the fixture baseline the D-11 side-by-side needs.
//
// THE REFUSAL. parseDumpListing() throws when the accounted byte total does not
// equal the declared image size, naming both counts in the message. That guard
// is the whole point: dxa emits label-only lines, `= * + n` continuation lines
// and space-separated `.word` lines alongside tab-separated instruction lines,
// so a regex that silently misses one shape under-counts instead of failing.
// A wrong number that looks plausible is worse than no number. It is also a
// free preview of DXA-02's own refusal requirement.
//
// The image size is an EXPLICIT argument, never inferred from the listing --
// inferring it from the same text the parser is being checked against would
// make the assertion vacuous.
//
// Run with: node dxa-listing-parse.mjs <listing-path> <image-size-bytes>

import { readFileSync } from "node:fs";

// The ONLY line-matching regular expression in this script.
const DUMP_LINE_RE = /^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$/;

/**
 * Parse a `dxa -a dump` listing into byte-level code/data address sets.
 *
 * @param {string} text          the listing, verbatim
 * @param {number} imageSize     declared size of the disassembled image, in bytes
 * @returns {{code: Set<number>, data: Set<number>, accounted: number,
 *            codeBytes: number, dataBytes: number, matchedLines: number,
 *            firstAddress: number, lastAddress: number}}
 * @throws {Error} when the accounted byte total !== imageSize
 */
export function parseDumpListing(text, imageSize) {
  if (!Number.isInteger(imageSize) || imageSize <= 0) {
    throw new Error(
      `parseDumpListing: imageSize must be a positive integer, got ${imageSize}`,
    );
  }

  const code = new Set();
  const data = new Set();
  let accounted = 0;
  let codeBytes = 0;
  let dataBytes = 0;
  let matchedLines = 0;
  let firstAddress = null;
  let lastAddress = null;

  for (const line of text.split("\n")) {
    const m = DUMP_LINE_RE.exec(line);
    if (m === null) continue;

    const address = parseInt(m[1], 16);
    const bytes = m[2].trim().split(/ +/);
    const rest = m[3];

    // Data iff the emitted text begins `.byt` or `.word`; anything else is an
    // instruction dxa chose to emit, i.e. code.
    const isData = rest.startsWith(".byt") || rest.startsWith(".word");
    const target = isData ? data : code;

    for (let i = 0; i < bytes.length; i += 1) {
      const a = address + i;
      target.add(a);
      accounted += 1;
      if (firstAddress === null || a < firstAddress) firstAddress = a;
      if (lastAddress === null || a > lastAddress) lastAddress = a;
    }

    if (isData) dataBytes += bytes.length;
    else codeBytes += bytes.length;
    matchedLines += 1;
  }

  if (accounted !== imageSize) {
    throw new Error(
      `dxa-listing-parse: accounted byte total ${accounted} does not equal ` +
        `expected image size ${imageSize}. Refusing to report an ` +
        `under-counted classification. accounted=${accounted} expected=${imageSize} ` +
        `(matched ${matchedLines} byte-emitting lines; an unseen line shape, an ` +
        `overlapping emission, or a wrong declared size is the cause).`,
    );
  }

  return {
    code,
    data,
    accounted,
    codeBytes,
    dataBytes,
    matchedLines,
    firstAddress,
    lastAddress,
  };
}

function main() {
  const listingPath = process.argv[2];
  const imageSize = Number(process.argv[3]);
  if (!listingPath || !Number.isFinite(imageSize)) {
    console.error(
      "Usage: node dxa-listing-parse.mjs <listing-path> <image-size-bytes>",
    );
    process.exitCode = 1;
    return;
  }

  const text = readFileSync(listingPath, "utf8");
  const r = parseDumpListing(text, imageSize);

  console.log(`LISTING: ${listingPath}`);
  console.log(`IMAGE_SIZE_DECLARED: ${imageSize}`);
  console.log(`PARSE_MATCHED_LINES: ${r.matchedLines}`);
  console.log(`PARSE_ACCOUNTED_BYTES: ${r.accounted}`);
  console.log(`PARSE_CODE_BYTES: ${r.codeBytes}`);
  console.log(`PARSE_DATA_BYTES: ${r.dataBytes}`);
  console.log(`PARSE_CODE_ADDRESSES: ${r.code.size}`);
  console.log(`PARSE_DATA_ADDRESSES: ${r.data.size}`);
  console.log(
    `PARSE_ADDRESS_RANGE: $${r.firstAddress.toString(16).padStart(4, "0")}-$${r.lastAddress
      .toString(16)
      .padStart(4, "0")}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
