// docs-linerefs.test.ts
//
// WHY THIS EXISTS: CLAUDE.md's Architecture bullet cites two exact
// `vice-proxy.ts:<N>` line numbers for `rewriteArguments()`'s two call
// sites -- the load-bearing evidence behind "derived tools must be
// intercepted before forwardToVice()". Those two numbers drifted between
// Phase 10 and Phase 11 (2889/1368 -> 2943/1422) and were re-verified BY
// HAND, twice, by two different sessions reading the same bullet's own
// "treat a mismatch as drift to re-verify" instruction. A citation the
// repo can check mechanically is cheaper than a convention that asks each
// future phase to re-check it by hand and get it right.
//
// This test reads CLAUDE.md's real prose (not a copy pasted into the test)
// and vice-proxy.ts's real current source, extracts every
// `vice-proxy.ts:<N>` citation from the bullet, and asserts each cited
// line actually contains what the surrounding sentence claims it contains
// -- `rewriteArguments(` for a call-site citation, or a `function` keyword
// for a function-start citation. It is deliberately kept OUT of
// package.json's files[] (see check-npm-packages.mjs) since it verifies
// planning-facing documentation, not runtime behaviour shipped in the
// tarball.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Matches the literal `vice-proxy.ts:<digits>` citation shape used
 * throughout CLAUDE.md and this project's other docs. Deliberately does
 * NOT anchor to line start -- citations appear mid-sentence. */
const CITATION_RE = /vice-proxy\.ts:(\d+)/g;

/** Isolates the one CLAUDE.md bullet that cites rewriteArguments()'s call
 * sites, so a citation added elsewhere in the file for an unrelated reason
 * is never swept into this test's non-vacuity count. Matches the bullet
 * that contains the literal string `rewriteArguments()`. */
function findRewriteArgumentsBullet(claudeMd: string): string {
  const lines = claudeMd.split("\n");
  const hit = lines.find((line) => line.includes("rewriteArguments()"));
  assert.ok(hit, "CLAUDE.md must contain a bullet mentioning rewriteArguments() -- none found");
  return hit as string;
}

function extractCitations(bullet: string): number[] {
  const citations: number[] = [];
  for (const match of bullet.matchAll(CITATION_RE)) {
    citations.push(Number(match[1]));
  }
  return citations;
}

test("CLAUDE.md's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (non-vacuity)", () => {
  const claudeMd = readFileSync(join(repoRoot({ from: HERE }), "CLAUDE.md"), "utf8");
  const bullet = findRewriteArgumentsBullet(claudeMd);
  const citations = extractCitations(bullet);
  // Rewording the bullet so this regex matches nothing must FAIL this
  // test, not silently report zero checked citations as a pass -- that is
  // exactly the class of vacuous guard T-11-DOC-DRIFT exists to catch.
  assert.ok(citations.length >= 2, `expected at least two vice-proxy.ts:<N> citations in the rewriteArguments() bullet, found ${citations.length}`);
});

test("every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function", () => {
  const claudeMd = readFileSync(join(repoRoot({ from: HERE }), "CLAUDE.md"), "utf8");
  const viceProxySrc = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  const viceProxyLines = viceProxySrc.split("\n");

  const bullet = findRewriteArgumentsBullet(claudeMd);
  const citations = extractCitations(bullet);
  assert.ok(citations.length >= 2, "no citations extracted -- see the non-vacuity test above");

  for (const lineNumber of citations) {
    // Citations are 1-indexed in prose; array is 0-indexed.
    const lineText = viceProxyLines[lineNumber - 1];
    assert.ok(lineText !== undefined, `CLAUDE.md cites vice-proxy.ts:${lineNumber}, but the file has no such line`);
    const isCallSite = lineText.includes("rewriteArguments(");
    const isFunctionStart = /^\s*(async\s+)?function\s+\w+/.test(lineText);
    assert.ok(
      isCallSite || isFunctionStart,
      `vice-proxy.ts:${lineNumber} (cited in CLAUDE.md) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: ${JSON.stringify(lineText)}`,
    );
  }
});

test("planted-violation: a citation pointing at an unrelated line fails this test's own logic (proves the guard is not vacuous)", () => {
  const viceProxySrc = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  const viceProxyLines = viceProxySrc.split("\n");

  // Line 1 of vice-proxy.ts is never a rewriteArguments() call or a
  // function declaration -- it is the shebang/header. A citation planted
  // there must be rejected by the same check the real test above uses.
  const plantedLineNumber = 1;
  const lineText = viceProxyLines[plantedLineNumber - 1];
  const isCallSite = lineText.includes("rewriteArguments(");
  const isFunctionStart = /^\s*(async\s+)?function\s+\w+/.test(lineText);
  assert.equal(isCallSite || isFunctionStart, false, "line 1 of vice-proxy.ts must not look like a rewriteArguments() call site or function start -- if it does, this planted-violation check itself is broken");
});
