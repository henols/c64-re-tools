#!/usr/bin/env node
// Throwaway fixture-baseline computation for phase 23 -- evidence, not a
// deliverable. Re-derives the 279-byte fixture's ground-truth code/data
// partition BYTE BY BYTE from the assembler's own report, then crosses it
// against evidence/dxa-listing-parse.mjs's classification of dxa's `-a dump`
// listing to produce the FIXTURE_* outcome lines.
//
// Why this file exists at all, and why it is separate from
// evidence/dxa-listing-parse.mjs: 23-02-PLAN.md's acceptance criteria require
// that the listing parser "contains exactly one line-matching regular
// expression". Deriving ground truth needs a second, unrelated regex over the
// acme report, so folding it into the parser would break that criterion. It is
// committed rather than left in PROBE_DIR because the fixture numbers are
// required evidence for D-11's side-by-side, and a number whose derivation
// lives only in tmpfs is not reproducible (evidence/README.md convention 2).
//
// It imports the parser rather than re-implementing it -- there is exactly one
// dxa listing parser in this phase.
//
// GROUND TRUTH METHOD (this is assumption A1 in 23-RESEARCH.md, tested here
// rather than taken on trust):
//   1. Read acme's -r report. Every line that emitted bytes carries the
//      emission address, its byte column, and the source text that emitted it.
//   2. Each emission's EXACT length is the byte column's length in bytes.
//      acme truncates that column with "..." above 8 bytes, so for a truncated
//      column the length is recovered from the directive itself (!fill's count,
//      an item count for !byte/!word, a string length for !text).
//   3. An emission is data iff its source text's first token is an acme data
//      pseudo-op (!byte / !by / !word / !wo / !text / !tx / !fill / !pet /
//      !scr / !raw). Everything else is an instruction, i.e. code.
//   4. Bytes inside the image that NO emission covers are assembler padding --
//      here, `* = $0810` after a 12-byte !byte block ending at $080c leaves
//      $080d-$080f zero-filled. Padding is its own third category, reported
//      separately and never silently folded into code or data. Both the
//      data-excluding-padding and data-including-padding denominators are
//      printed, because which one the pivot used is exactly the open question.
//
// Run with: node fixture-baseline.mjs <report> <listing> <loadAddr> <imageSize>

import { readFileSync } from "node:fs";
import { parseDumpListing } from "../dxa-listing-parse.mjs";

// Emitting report line: leading line number, then the emission address, then
// the (possibly truncated) byte column, then the source text.
const REPORT_EMIT_RE = /^\s*\d+\s+([0-9a-f]{4})\s+([0-9a-f.]+)\s+(.*)$/;

const DATA_PSEUDO_OPS = new Set([
  "!byte", "!by", "!8",
  "!word", "!wo", "!16",
  "!text", "!tx",
  "!fill", "!fi",
  "!pet", "!scr", "!raw",
]);

// Recover the emitted length of a data directive whose byte column acme
// truncated. Only the forms this fixture actually uses are handled; anything
// else throws rather than guessing.
function directiveLength(source) {
  const [op, ...restParts] = source.split(/\s+/);
  const rest = restParts.join(" ").trim();
  const opLower = op.toLowerCase();

  if (opLower === "!fill" || opLower === "!fi") {
    const countText = rest.split(",")[0].trim();
    const n = countText.startsWith("$")
      ? parseInt(countText.slice(1), 16)
      : Number(countText);
    if (!Number.isInteger(n)) {
      throw new Error(`fixture-baseline: cannot read !fill count from "${source}"`);
    }
    return n;
  }

  const items = rest.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (opLower === "!byte" || opLower === "!by" || opLower === "!8") return items.length;
  if (opLower === "!word" || opLower === "!wo" || opLower === "!16") return items.length * 2;
  if (["!text", "!tx", "!pet", "!scr", "!raw"].includes(opLower)) {
    let total = 0;
    for (const item of items) {
      if (item.startsWith('"') && item.endsWith('"')) total += item.length - 2;
      else total += 1;
    }
    return total;
  }

  throw new Error(
    `fixture-baseline: byte column truncated and directive "${op}" is not one ` +
      `whose length this script knows how to recover (source: "${source}")`,
  );
}

function deriveGroundTruth(reportText, loadAddr, imageSize) {
  const emissions = [];
  for (const line of reportText.split("\n")) {
    const m = REPORT_EMIT_RE.exec(line);
    if (m === null) continue;
    const address = parseInt(m[1], 16);
    const column = m[2];
    const source = m[3].trim();
    const firstToken = source.split(/\s/)[0].toLowerCase();
    const truncated = column.endsWith("...");
    const length = truncated ? directiveLength(source) : column.length / 2;
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error(
        `fixture-baseline: bad emission length ${length} at ${address.toString(16)} ("${source}")`,
      );
    }
    emissions.push({
      address,
      source,
      length,
      truncated,
      isData: DATA_PSEUDO_OPS.has(firstToken),
    });
  }
  emissions.sort((a, b) => a.address - b.address);

  const code = new Set();
  const data = new Set();

  for (const e of emissions) {
    const target = e.isData ? data : code;
    for (let a = e.address; a < e.address + e.length; a += 1) target.add(a);
  }

  // Anything inside the image that no emission covers is assembler padding.
  const pad = new Set();
  const padRanges = [];
  let runStart = null;
  for (let a = loadAddr; a < loadAddr + imageSize; a += 1) {
    const covered = code.has(a) || data.has(a);
    if (!covered) {
      pad.add(a);
      if (runStart === null) runStart = a;
    } else if (runStart !== null) {
      padRanges.push([runStart, a - 1]);
      runStart = null;
    }
  }
  if (runStart !== null) padRanges.push([runStart, loadAddr + imageSize - 1]);

  const accounted = code.size + data.size + pad.size;
  if (accounted !== imageSize) {
    throw new Error(
      `fixture-baseline: ground-truth accounted ${accounted} bytes, expected ` +
        `${imageSize}. Refusing to report a partition that does not tile the image.`,
    );
  }
  const overlap = [...code].filter((a) => data.has(a));
  if (overlap.length !== 0) {
    throw new Error(
      `fixture-baseline: ground-truth code and data overlap on ${overlap.length} bytes.`,
    );
  }

  return { code, data, pad, padRanges, emissions };
}

function hex(a) {
  return `$${a.toString(16).padStart(4, "0")}`;
}

function pct(n, d) {
  return `${((n / d) * 100).toFixed(2)} (${n}/${d})`;
}

function main() {
  const [reportPath, listingPath, loadAddrArg, imageSizeArg] = process.argv.slice(2);
  if (!reportPath || !listingPath || !loadAddrArg || !imageSizeArg) {
    console.error(
      "Usage: node fixture-baseline.mjs <report> <listing> <loadAddrHex> <imageSize>",
    );
    process.exitCode = 1;
    return;
  }
  const loadAddr = parseInt(loadAddrArg, 16);
  const imageSize = Number(imageSizeArg);

  const gt = deriveGroundTruth(readFileSync(reportPath, "utf8"), loadAddr, imageSize);
  const dxa = parseDumpListing(readFileSync(listingPath, "utf8"), imageSize);

  console.log("--- ground truth, re-derived from the acme report ---");
  console.log(`GT_EMISSIONS: ${gt.emissions.length}`);
  console.log(`GT_TRUNCATED_COLUMNS_RECOVERED: ${gt.emissions.filter((e) => e.truncated).length}`);
  console.log(`GT_CODE_BYTES: ${gt.code.size}`);
  console.log(`GT_DATA_BYTES: ${gt.data.size}`);
  console.log(`GT_PAD_BYTES: ${gt.pad.size}`);
  for (const [lo, hi] of gt.padRanges) {
    console.log(
      `GT_PAD_RANGE: ${hex(lo)}-${hex(hi)} (${hi - lo + 1} bytes, emitted by no ` +
        `source directive; assembler fill from a \`* =\` re-origin)`,
    );
  }

  console.log("");
  console.log("--- dxa's classification, via evidence/dxa-listing-parse.mjs ---");
  console.log(`DXA_MATCHED_LINES: ${dxa.matchedLines}`);
  console.log(`DXA_ACCOUNTED_BYTES: ${dxa.accounted}`);
  console.log(`DXA_CODE_BYTES: ${dxa.codeBytes}`);
  console.log(`DXA_DATA_BYTES: ${dxa.dataBytes}`);

  // SCHEMA.md section 4: positive class is data, denominator is certain-data bytes.
  // Two candidate true-data sets, because padding attribution is exactly the
  // open question: strict (directive-emitted data only) and wide (plus the
  // assembler fill). Both are crossed and both are printed; neither is chosen
  // after seeing which one flatters the result.
  const dataWide = new Set([...gt.data, ...gt.pad]);

  const cross = (trueData) => ({
    recovered: [...dxa.data].filter((a) => trueData.has(a)).length,
    falsePositives: [...dxa.data].filter((a) => !trueData.has(a)).length,
    falseNegatives: [...trueData].filter((a) => dxa.code.has(a)).length,
    denominator: trueData.size,
  });

  const strict = cross(gt.data);
  const wide = cross(dataWide);

  console.log("");
  console.log("--- crossed, per SCHEMA.md section 4 definitions ---");
  console.log(`CROSS_STRICT_TRUE_DATA_BYTES: ${strict.denominator}`);
  console.log(`CROSS_STRICT_RECOVERED: ${strict.recovered}`);
  console.log(`CROSS_STRICT_FALSE_POSITIVES: ${strict.falsePositives}`);
  console.log(`CROSS_STRICT_FALSE_NEGATIVES: ${strict.falseNegatives}`);
  console.log(`CROSS_WIDE_TRUE_DATA_BYTES: ${wide.denominator}`);
  console.log(`CROSS_WIDE_RECOVERED: ${wide.recovered}`);
  console.log(`CROSS_WIDE_FALSE_POSITIVES: ${wide.falsePositives}`);
  console.log(`CROSS_WIDE_FALSE_NEGATIVES: ${wide.falseNegatives}`);

  console.log("");
  console.log("--- against the published pivot figures ---");
  const publishedGtCode = 141;
  const publishedGtData = 138;
  console.log(`PUBLISHED_GT_CODE_BYTES: ${publishedGtCode}`);
  console.log(`PUBLISHED_GT_DATA_BYTES: ${publishedGtData}`);
  console.log(`REDERIVED_GT_CODE_BYTES: ${gt.code.size}`);
  console.log(`REDERIVED_GT_DATA_BYTES_STRICT: ${gt.data.size}`);
  console.log(`REDERIVED_GT_DATA_BYTES_WITH_PADDING: ${dataWide.size}`);
  console.log(
    `GT_PARTITION_MATCHES_PUBLISHED: ${
      gt.code.size === publishedGtCode &&
      (gt.data.size === publishedGtData || dataWide.size === publishedGtData)
        ? "yes"
        : "no"
    }`,
  );

  console.log("");
  console.log("--- the three candidate denominators, all printed ---");
  console.log(`ON_STRICT_DENOMINATOR_RECOVERY: ${pct(strict.recovered, strict.denominator)}`);
  console.log(`ON_STRICT_DENOMINATOR_FALSE_NEGATIVES: ${pct(strict.falseNegatives, strict.denominator)}`);
  console.log(`ON_WIDE_DENOMINATOR_RECOVERY: ${pct(wide.recovered, wide.denominator)}`);
  console.log(`ON_WIDE_DENOMINATOR_FALSE_NEGATIVES: ${pct(wide.falseNegatives, wide.denominator)}`);
  console.log(`ON_PUBLISHED_DENOMINATOR_RECOVERY: ${pct(wide.recovered, publishedGtData)}`);
  console.log(`ON_PUBLISHED_DENOMINATOR_FALSE_NEGATIVES: ${pct(wide.falseNegatives, publishedGtData)}`);

  console.log("");
  console.log("--- the false positives, listed, because the published claim is 0 ---");
  const fpAddresses = [...dxa.data].filter((a) => !dataWide.has(a)).sort((x, y) => x - y);
  console.log(`FP_ADDRESSES: ${fpAddresses.length === 0 ? "none" : fpAddresses.map(hex).join(" ")}`);

  // Reconstruction of the published partition. 141/138 differs from the wide
  // re-derivation by exactly four bytes, and this is the hypothesis for which
  // four: a hand-derivation that (a) lumped the whole inline-parameter span
  // $0863-$086f into one data blob, absorbing the second `jsr print` opcode at
  // $0869-$086b, and (b) counted the self-modified operand cell at $08a6 --
  // the byte `sta l8a6` writes at runtime -- as data. Stated as a hypothesis
  // and then CHECKED against all four published figures, not asserted.
  const RECON_EXTRA_DATA = [0x0869, 0x086a, 0x086b, 0x08a6];
  const dataRecon = new Set([...dataWide, ...RECON_EXTRA_DATA]);
  const codeRecon = new Set([...gt.code].filter((a) => !dataRecon.has(a)));
  const recon = {
    recovered: [...dxa.data].filter((a) => dataRecon.has(a)).length,
    falsePositives: [...dxa.data].filter((a) => codeRecon.has(a)).length,
    falseNegatives: [...dataRecon].filter((a) => dxa.code.has(a)).length,
  };
  console.log("");
  console.log("--- reconstruction of the published 141/138 partition ---");
  console.log(`RECON_EXTRA_DATA: ${RECON_EXTRA_DATA.map(hex).join(" ")}`);
  console.log(`RECON_CODE_BYTES: ${codeRecon.size}`);
  console.log(`RECON_DATA_BYTES: ${dataRecon.size}`);
  console.log(`RECON_RECOVERY: ${pct(recon.recovered, dataRecon.size)}`);
  console.log(`RECON_FALSE_POSITIVES: ${recon.falsePositives}`);
  console.log(`RECON_FALSE_NEGATIVES: ${pct(recon.falseNegatives, dataRecon.size)}`);
  const reconMatches =
    codeRecon.size === publishedGtCode &&
    dataRecon.size === publishedGtData &&
    recon.recovered === 100 &&
    recon.falsePositives === 0 &&
    recon.falseNegatives === 38;
  console.log(`RECON_REPRODUCES_ALL_PUBLISHED_FIGURES: ${reconMatches ? "yes" : "no"}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
