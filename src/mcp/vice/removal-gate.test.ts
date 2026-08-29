// removal-gate.test.ts
//
// WHY THIS FILE EXISTS (CUT-02/CUT-03, phase 29 plan 29-02): the removal gate
// at `scripts/check-no-<subject>.mjs` is the guard that keeps the deleted
// static-analysis integration deleted. A structural guard is proven in this
// project by a PLANTED VIOLATION OBSERVED RED, never by reading it -- and a
// planted violation proved against a re-implementation of the rule proves
// nothing about the rule the real scan applies. So this file imports the
// gate's OWN exported predicates and drives synthetic bodies through them.
//
// FOUR ROUTES, because the gate has four evasion routes and a guard that
// covers three of them is a guard with a hole:
//   (a) a surviving `src/mcp/vice/*.ts` module body
//   (b) a `docs/*.md` page outside the exemption set
//   (c) a `scripts/*.mjs` CI helper
//   (d) a SHIPPED skill playbook -- `installer/skills/**`, which
//       `git ls-files` cannot see at all
// Routes (a) and (b) are committed fixture bodies under `fixtures/planted-`
// so the plant is a real file with real bytes rather than a string this test
// could quietly stop asserting about; routes (c) and (d) are composed here.
//
// THE NEEDLE IS NEVER WRITTEN INTO THIS FILE'S SOURCE. Every synthetic body
// is composed from the gate's exported `SUBJECT_NEEDLE`, for the same reason
// the gate composes it from two fragments: a test that carries the literal
// would need its own content exemption, and an exemption over a test body is
// one edit away from covering anything.
//
// WHAT NOT TO DO: do not re-derive the scan rule here. If this file ever
// declares its own "does the text contain the subject" helper, the planted
// violations stop saying anything about the gate that actually runs in CI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SUBJECT_NEEDLE,
  subjectHits,
  attributionBlocks,
  isInsideAttributionBlock,
} from "../../../scripts/check-no-regenerator2000.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

const N = SUBJECT_NEEDLE;

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

// ---------------------------------------------------------------------------
// Route (a): a surviving TypeScript module body
// ---------------------------------------------------------------------------

test("planted violation, route (a): a `src/mcp/vice/*.ts` module body is reported, with the line number", () => {
  const body = fixture("planted-removal-fixture.ts.txt");
  const hits = subjectHits("src/mcp/vice/some-surviving-module.ts", body);

  assert.equal(hits.length, 1, "the planted .ts fixture must be reported exactly once");
  const line = hits[0]!;
  assert.ok(line > 0, "the occurrence is in the CONTENT, so its reported line must not be the path sentinel 0");
  assert.match(
    body.split("\n")[line - 1]!.toLowerCase(),
    new RegExp(N, "i"),
    "the reported line number must point at the line that actually carries the subject",
  );

  // Self-non-vacuity: if the predicate were stubbed to report nothing, this
  // is the assertion that would catch it.
  const stubbedAlwaysEmpty = (): number[] => [];
  assert.notDeepEqual(stubbedAlwaysEmpty(), hits);
});

// ---------------------------------------------------------------------------
// Route (b): a docs/ markdown page
// ---------------------------------------------------------------------------

test("planted violation, route (b): a `docs/*.md` body outside the exemption set is reported, with the line number", () => {
  const body = fixture("planted-removal-fixture.md.txt");
  const hits = subjectHits("docs/some-new-page.md", body);

  assert.equal(hits.length, 1, "the planted .md fixture must be reported exactly once");
  assert.match(body.split("\n")[hits[0]! - 1]!.toLowerCase(), new RegExp(N, "i"));

  const stubbedAlwaysEmpty = (): number[] => [];
  assert.notDeepEqual(stubbedAlwaysEmpty(), hits);
});

// ---------------------------------------------------------------------------
// Route (c): a scripts/*.mjs CI helper -- invisible to BOTH tsconfig.json
// (which compiles only **/*.ts and **/*.mts) and `node --test '*.test.*'`.
// ---------------------------------------------------------------------------

test("planted violation, route (c): a `scripts/*.mjs` body is reported, with the line number", () => {
  const body = [
    "#!/usr/bin/env node",
    "// a CI helper that has re-acquired the retired dependency",
    'import { execFileSync } from "node:child_process";',
    "",
    "export function probe() {",
    `  return execFileSync("${N}", ["--version"], { encoding: "utf8" });`,
    "}",
    "",
  ].join("\n");

  const hits = subjectHits("scripts/check-something.mjs", body);
  assert.deepEqual(hits, [6], "the occurrence on line 6 must be reported by line number");

  const stubbedAlwaysEmpty = (): number[] => [];
  assert.notDeepEqual(stubbedAlwaysEmpty(), hits);
});

// ---------------------------------------------------------------------------
// Route (d): a SHIPPED skill playbook. `git ls-files installer/skills` returns
// zero, so this is the route a tracked-files predicate is structurally blind
// to and the one the packFiles() half of the scope predicate exists for.
// ---------------------------------------------------------------------------

test("planted violation, route (d): a shipped `installer/skills/**/SKILL.md` body is reported, with the line number", () => {
  const body = [
    "---",
    "name: some-skill",
    "description: Reverse-engineer a C64 program.",
    "---",
    "",
    "## Prerequisites",
    "",
    `Install ${N} and make sure it is on your PATH before running step 2.`,
    "",
  ].join("\n");

  const hits = subjectHits("installer/skills/some-skill/SKILL.md", body);
  assert.deepEqual(hits, [8], "the occurrence on line 8 must be reported by line number");

  const stubbedAlwaysEmpty = (): number[] => [];
  assert.notDeepEqual(stubbedAlwaysEmpty(), hits);
});

// ---------------------------------------------------------------------------
// The path half of the predicate: an occurrence in the PATH, not the content.
// ---------------------------------------------------------------------------

test("the predicate scans the path as well as the content, and reports a path occurrence as the sentinel 0", () => {
  const hits = subjectHits(`docs/${N}-notes.md`, "a body that never names the subject\n");
  assert.deepEqual(hits, [0]);
});

// ---------------------------------------------------------------------------
// FALSE-POSITIVE CONTROL: an exempted attribution block is NOT reported as a
// violation. Driven through the gate's own block predicate -- the same one
// the real scan calls -- rather than through a copy of the shape rules.
// ---------------------------------------------------------------------------

test("false-positive control: an occurrence inside a shape-matched attribution block is exempt, and one outside it is not", () => {
  const notices = [
    "# Third-Party Notices for `@example/pkg`", // 1
    "", // 2
    "This package is MIT-licensed.", // 3
    "", // 4
    `## Incorporated material — ${N} analysis procedures (MIT OR Apache-2.0)`, // 5
    "", // 6
    `Prose adapted from ${N}'s own analysis procedures at a pinned commit.`, // 7
    "", // 8
    "## Runtime dependency", // 9
    "", // 10
    `This package shells out to ${N} at runtime.`, // 11
    "", // 12
  ].join("\n");

  const hits = subjectHits("THIRD-PARTY-NOTICES.md", notices);
  assert.deepEqual(hits, [5, 7, 11], "all three occurrences must be reported UNCONDITIONALLY by the scan");

  const blocks = attributionBlocks(notices);
  assert.equal(blocks.length, 1, "exactly one block must shape-match as an attribution block");

  const exempt = hits.filter((line) => isInsideAttributionBlock(notices, line));
  const notExempt = hits.filter((line) => !isInsideAttributionBlock(notices, line));
  assert.deepEqual(exempt, [5, 7], "the attribution block's own occurrences are exempt");
  assert.deepEqual(
    notExempt,
    [11],
    "an occurrence one section outside the attribution block is NOT exempt -- a block-scoped exemption that " +
      "covered it would be a file-scoped exemption wearing a block's name",
  );

  const stubbedAlwaysEmpty = (): number[] => [];
  assert.notDeepEqual(stubbedAlwaysEmpty(), hits);
  assert.notDeepEqual(stubbedAlwaysEmpty(), notExempt);
});

test("CUT-03 non-vacuity: deleting the attribution block turns its occurrences into unexempted ones", () => {
  const withBlock = [
    "# Third-Party Notices", // 1
    "", // 2
    `## Upstream MIT permission notice (${N})`, // 3
    "", // 4
    `Reproduced below is LICENSE-MIT from the ${N} repository.`, // 5
    "", // 6
  ].join("\n");
  const withoutBlock = [
    "# Third-Party Notices", // 1
    "", // 2
    "## Upstream MIT permission notice", // 3  <- the shape anchor removed
    "", // 4
    `Reproduced below is LICENSE-MIT from the ${N} repository.`, // 5
    "", // 6
  ].join("\n");

  assert.equal(attributionBlocks(withBlock).length, 1);
  assert.equal(
    attributionBlocks(withoutBlock).length,
    0,
    "with the heading shape gone the section is no longer an attribution block -- which is what makes deleting " +
      "one trip the gate instead of silencing it",
  );
  assert.equal(isInsideAttributionBlock(withBlock, 5), true);
  assert.equal(isInsideAttributionBlock(withoutBlock, 5), false);
});

// ---------------------------------------------------------------------------
// BINARY SAFETY, proved behaviourally against the real tree.
//
// The memmap renderer carries a literal NUL byte, so GNU grep classifies the
// whole file as binary and skips it under `grep -c`/`grep -o`. A gate that
// shelled out to grep would inherit that blindness and let a real occurrence
// survive its own removal check. The file is located by SHAPE, not by its
// current name, so plan 29-05's rename to `anno-memmap-render.ts` does not
// silently turn this into a test of nothing.
// ---------------------------------------------------------------------------

test("binary safety: the one occurrence in the NUL-carrying memmap renderer is reported, in-process", () => {
  const candidates = readdirSync(HERE).filter((n) => /memmap-render\.ts$/.test(n));
  assert.equal(
    candidates.length,
    1,
    `expected exactly one memmap renderer module in ${HERE}, found: ${candidates.join(", ") || "none"}`,
  );
  const rel = `src/mcp/vice/${candidates[0]!}`;
  const bytes = readFileSync(join(HERE, candidates[0]!));
  assert.ok(bytes.includes(0x00), `${rel} must still carry the NUL byte that makes this test meaningful`);

  const hits = subjectHits(rel, bytes.toString("utf8"));
  assert.deepEqual(
    hits,
    [79],
    "the measurement-provenance comment must be reported -- a grep-backed implementation reports nothing here",
  );
});
