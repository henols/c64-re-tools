#!/usr/bin/env node
// Throwaway line-by-line matcher for phase 9 criterion 3(3) -- evidence, not a
// deliverable. Tests every line of a VICE label file against the EXACT regex this
// repo's real consumer uses, copied verbatim (not paraphrased, not re-derived):
//
//   .claude/mcp/vice/stock-symbols.ts:75
//   const VICE_LABEL_LINE_RE = /^al\s+C:([0-9a-fA-F]{1,4})\s+\.(\S+)/;
//
// This script deliberately does NOT import from stock-symbols.ts (it is a .ts module
// with a non-exported const, and this plan must not add an export to it just for a
// throwaway probe script). It mirrors the consumer's own line-handling from
// stock-symbols.ts:196-226 (parseViceLabelFile): split on "\n", trim each line, blank
// lines counted separately from non-matching lines, regex tested against the trimmed
// line. This is the ONLY regex in this script -- no second label-file parser is
// written here.
//
// Run with: node grammar-check.mjs <path-to-.lbl-file>

const VICE_LABEL_LINE_RE = /^al\s+C:([0-9a-fA-F]{1,4})\s+\.(\S+)/;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node grammar-check.mjs <path-to-.lbl-file>");
    process.exitCode = 1;
    return;
  }

  const { readFileSync } = await import("node:fs");
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");

  let blankCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;
  const matches = [];

  console.log(`FILE: ${filePath}`);
  console.log(`TOTAL_LINES (split on "\\n", including any trailing empty element): ${lines.length}`);
  console.log("");

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();

    if (line === "") {
      blankCount += 1;
      console.log(`${lineNo}: (blank) -- SKIPPED (blank)`);
      return;
    }

    const match = VICE_LABEL_LINE_RE.exec(line);
    if (!match) {
      unmatchedCount += 1;
      console.log(`${lineNo}: ${JSON.stringify(rawLine)} -- NO MATCH`);
      return;
    }

    matchedCount += 1;
    const address = parseInt(match[1], 16);
    const name = match[2];
    matches.push({ lineNo, address, name });
    console.log(`${lineNo}: ${JSON.stringify(rawLine)} -- MATCH (address=0x${address.toString(16)}, name="${name}")`);
  });

  const nonBlankTotal = matchedCount + unmatchedCount;

  console.log("");
  console.log("SUMMARY:");
  console.log(`  total lines (incl. trailing empty split element): ${lines.length}`);
  console.log(`  blank lines: ${blankCount}`);
  console.log(`  matched: ${matchedCount}`);
  console.log(`  unmatched (non-blank, no match): ${unmatchedCount}`);
  console.log(`  non-blank total: ${nonBlankTotal}`);
  console.log("");
  console.log("MATCHES (parsed address, name):");
  for (const m of matches) {
    console.log(`  line ${m.lineNo}: 0x${m.address.toString(16).padStart(4, "0")} -> ${m.name}`);
  }
  console.log("");
  console.log(`GRAMMAR_MATCH: ${matchedCount}/${nonBlankTotal}`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exitCode = 1;
});
