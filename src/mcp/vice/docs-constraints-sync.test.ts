// docs-constraints-sync.test.ts
//
// WHY THIS EXISTS: the Constraints bullet list is stored TWICE -- once in
// `.planning/PROJECT.md` under `## Constraints`, and once in `CLAUDE.md`
// inside a marker block whose own comment claims `source:PROJECT.md`. That
// marker asserts a provenance relationship, and nothing verified it. The two
// copies drifted anyway: the Node floor moved to `>=24.0.0` in
// `package.json`'s `engines` and only CLAUDE.md's copy followed; three
// binary-monitor limits gained measured text-channel qualifications and only
// CLAUDE.md's copy gained them; and five bullets describing a retired
// static-analysis backend survived only in PROJECT.md's copy.
//
// The damage is not that one copy is stale. It is that the STALE copy is the
// one the marker names as the source, so regenerating the block would have
// pushed the stale text back OVER the corrected text -- reinstating a wrong
// Node floor and five bullets about a tool that no longer exists into the
// file loaded into every session. A silent drift between two copies of the
// same rules is a loaded gun pointed at whichever copy is currently right.
//
// THE PRECEDENT, which is why this guard is byte-equality and not a summary
// check: `docs-linerefs.test.ts` was itself widened once for exactly this
// failure mode. Its header records that PROJECT.md's copy of the
// `rewriteArguments()` bullet went stale and STAYED stale for a whole
// milestone "for exactly one reason ... docs-linerefs.test.ts was found to
// read only CLAUDE.md and not this copy". That widening fixed four numbers
// inside one bullet. It cannot see any other divergence between the two
// copies, and did not see these.
//
// WHAT THIS CHECKS: the two bullet lists are byte-identical, in the same
// order. Not a subset, not a fuzzy match -- if the two documents are to
// carry the same rules, "the same" is the only honest bar, and anything
// weaker re-opens the gap that let a wrong Node floor sit in the source
// copy while the projected copy was right.
//
// The predicates below RETURN their findings rather than asserting
// internally, so the planted-violation tests at the bottom drive the REAL
// rule against in-memory document bodies -- no fixture files, no filesystem
// writes, and no second implementation of the rule that would prove nothing
// about the rule the real checks apply.
//
// Like the other document guards, this file verifies planning-facing
// documentation rather than shipped runtime behaviour, so it is deliberately
// kept out of `package.json`'s `files[]`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The authoritative copy: a top-level `## Constraints` section. */
const SOURCE_DOC = ".planning/PROJECT.md";
/** The projected copy: a `### Constraints` heading inside the marker block. */
const PROJECTED_DOC = "CLAUDE.md";

const BLOCK_START = "<!-- GSD:project-start";
const BLOCK_END = "<!-- GSD:project-end";

/** A bullet line, as the two documents both write them: `- **Label**: ...`.
 * Anchored on the bold label so a stray list item in prose cannot be
 * mistaken for a constraint. */
const BULLET = /^- \*\*[^*]+\*\*: /;

interface Extraction {
  /** Constraint bullet lines, verbatim, in document order. */
  readonly bullets: readonly string[];
  /** Non-empty when the document's shape stopped the extraction from being
   * meaningful. A shape problem must never read as "zero divergence". */
  readonly problems: readonly string[];
}

/** Collect the bullet lines that follow `heading`, stopping at the next
 * markdown heading of the same or shallower depth, or at `stopAt`. */
function bulletsUnderHeading(
  lines: readonly string[],
  heading: string,
  stopAt: (line: string) => boolean,
): Extraction {
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) {
    return { bullets: [], problems: [`heading not found: ${JSON.stringify(heading)}`] };
  }
  if (lines.slice(start + 1).some((l) => l.trim() === heading)) {
    return {
      bullets: [],
      problems: [`heading appears more than once, so the scanned region is ambiguous: ${JSON.stringify(heading)}`],
    };
  }

  const bullets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (stopAt(line)) break;
    if (BULLET.test(line)) bullets.push(line);
  }
  return { bullets, problems: [] };
}

/** PROJECT.md's copy: `## Constraints` up to the next `## ` heading. */
export function sourceConstraints(text: string): Extraction {
  const lines = text.split("\n");
  return bulletsUnderHeading(lines, "## Constraints", (l) => l.startsWith("## "));
}

/** CLAUDE.md's copy: `### Constraints` inside the marker block, up to the
 * next heading or the block's own end marker. */
export function projectedConstraints(text: string): Extraction {
  const lines = text.split("\n");
  const open = lines.findIndex((l) => l.startsWith(BLOCK_START));
  const close = lines.findIndex((l) => l.startsWith(BLOCK_END));
  if (open === -1 || close === -1 || close < open) {
    return { bullets: [], problems: [`marker block ${BLOCK_START} ... ${BLOCK_END} not found or inverted`] };
  }
  return bulletsUnderHeading(
    lines.slice(open, close),
    "### Constraints",
    (l) => l.startsWith("#") || l.startsWith(BLOCK_END),
  );
}

/** Every way the two copies disagree, as human-readable findings. Empty
 * means the two lists are byte-identical and in the same order. */
export function divergences(source: Extraction, projected: Extraction): string[] {
  const problems = [...source.problems, ...projected.problems];
  if (problems.length > 0) return problems;

  const found: string[] = [];
  if (source.bullets.length !== projected.bullets.length) {
    found.push(
      `bullet COUNT differs: ${SOURCE_DOC} has ${source.bullets.length}, ` +
        `${PROJECTED_DOC} has ${projected.bullets.length}`,
    );
  }
  const n = Math.max(source.bullets.length, projected.bullets.length);
  for (let i = 0; i < n; i++) {
    const a = source.bullets[i];
    const b = projected.bullets[i];
    if (a === b) continue;
    if (a === undefined) found.push(`bullet ${i + 1} exists only in ${PROJECTED_DOC}: ${label(b!)}`);
    else if (b === undefined) found.push(`bullet ${i + 1} exists only in ${SOURCE_DOC}: ${label(a)}`);
    else found.push(`bullet ${i + 1} (${label(a)}) differs between the two copies`);
  }
  return found;
}

/** The bold label plus enough of the sentence to recognise the bullet. */
function label(bullet: string): string {
  return JSON.stringify(bullet.slice(0, 90));
}

function read(doc: string): string {
  return readFileSync(join(repoRoot({ from: HERE }), doc), "utf8");
}

// -- 1. The real documents ---------------------------------------------------

test("non-vacuity: both copies of the Constraints list are found and substantial", () => {
  const source = sourceConstraints(read(SOURCE_DOC));
  const projected = projectedConstraints(read(PROJECTED_DOC));

  assert.deepEqual(source.problems, [], `${SOURCE_DOC}: ${source.problems.join("; ")}`);
  assert.deepEqual(projected.problems, [], `${PROJECTED_DOC}: ${projected.problems.join("; ")}`);

  // A guard that silently scans an empty region agrees with everything. The
  // floor is well under the real count so a deliberate pruning does not red
  // this, but a broken extractor does.
  assert.ok(
    source.bullets.length >= 20,
    `${SOURCE_DOC} yielded only ${source.bullets.length} constraint bullets -- the extractor is probably ` +
      `scanning the wrong region`,
  );
  assert.ok(
    projected.bullets.length >= 20,
    `${PROJECTED_DOC} yielded only ${projected.bullets.length} constraint bullets -- the extractor is probably ` +
      `scanning the wrong region`,
  );
});

test("the two copies of the Constraints list are byte-identical, in the same order", () => {
  const found = divergences(sourceConstraints(read(SOURCE_DOC)), projectedConstraints(read(PROJECTED_DOC)));

  assert.deepEqual(
    found,
    [],
    `${SOURCE_DOC} and ${PROJECTED_DOC} carry different Constraints lists. The marker block in ` +
      `${PROJECTED_DOC} names ${SOURCE_DOC} as its source, so leaving these divergent means a regeneration ` +
      `overwrites whichever copy is currently correct. Reconcile them -- do not silence this by editing the ` +
      `guard:\n  ` + found.join("\n  "),
  );
});

// -- 2. Planted violations, driving the real rule -----------------------------

const SYNTHETIC_SOURCE = [
  "# Doc",
  "",
  "## Constraints",
  "",
  "- **Alpha**: the first rule.",
  "- **Beta**: the second rule.",
  "",
  "## After",
  "",
  "- **Gamma**: not a constraint, it is past the section.",
].join("\n");

function syntheticProjected(bullets: readonly string[]): string {
  return [
    "# CLAUDE",
    "",
    `${BLOCK_START} source:PROJECT.md -->`,
    "## Project",
    "",
    "### Constraints",
    "",
    ...bullets,
    `${BLOCK_END} -->`,
    "",
    "## Local section",
    "",
    "- **Delta**: outside the block entirely.",
  ].join("\n");
}

test("planted control: two synthetic copies that agree are reported as agreeing", () => {
  const source = sourceConstraints(SYNTHETIC_SOURCE);
  const projected = projectedConstraints(
    syntheticProjected(["- **Alpha**: the first rule.", "- **Beta**: the second rule."]),
  );

  assert.deepEqual(source.bullets, ["- **Alpha**: the first rule.", "- **Beta**: the second rule."]);
  assert.deepEqual(projected.bullets, source.bullets, "the projected extractor must read the same two bullets");
  assert.deepEqual(divergences(source, projected), [], "identical lists must produce no findings");
});

test("planted violation: a one-word difference inside a bullet is reported", () => {
  const projected = projectedConstraints(
    syntheticProjected(["- **Alpha**: the FIRST rule.", "- **Beta**: the second rule."]),
  );
  const found = divergences(sourceConstraints(SYNTHETIC_SOURCE), projected);

  assert.equal(found.length, 1, `expected exactly one finding, got: ${found.join(" | ")}`);
  assert.match(found[0]!, /bullet 1 .*differs between the two copies/);
});

test("planted violation: a bullet present in only one copy is reported, in both directions", () => {
  const dropped = divergences(
    sourceConstraints(SYNTHETIC_SOURCE),
    projectedConstraints(syntheticProjected(["- **Alpha**: the first rule."])),
  );
  assert.ok(
    dropped.some((f) => /exists only in \.planning\/PROJECT\.md/.test(f)),
    `a bullet dropped from the projected copy must be reported: ${dropped.join(" | ")}`,
  );

  const added = divergences(
    sourceConstraints(SYNTHETIC_SOURCE),
    projectedConstraints(
      syntheticProjected([
        "- **Alpha**: the first rule.",
        "- **Beta**: the second rule.",
        "- **Epsilon**: invented in the projected copy only.",
      ]),
    ),
  );
  assert.ok(
    added.some((f) => /exists only in CLAUDE\.md/.test(f)),
    `a bullet invented in the projected copy must be reported: ${added.join(" | ")}`,
  );
});

test("planted violation: a reordering is reported rather than accepted as a set match", () => {
  const found = divergences(
    sourceConstraints(SYNTHETIC_SOURCE),
    projectedConstraints(syntheticProjected(["- **Beta**: the second rule.", "- **Alpha**: the first rule."])),
  );
  assert.equal(found.length, 2, `both positions must be reported, got: ${found.join(" | ")}`);
});

test("a missing heading or marker block is a PROBLEM, never a silent zero-divergence pass", () => {
  const noHeading = sourceConstraints("# Doc\n\n## Something Else\n\n- **Alpha**: x.\n");
  assert.equal(noHeading.bullets.length, 0);
  assert.match(noHeading.problems.join(" "), /heading not found/);

  const noBlock = projectedConstraints("# CLAUDE\n\n### Constraints\n\n- **Alpha**: x.\n");
  assert.equal(noBlock.bullets.length, 0);
  assert.match(noBlock.problems.join(" "), /marker block .* not found or inverted/);

  // The decisive property: a shape problem must surface through divergences()
  // instead of being drowned by two empty lists comparing equal.
  assert.ok(divergences(noHeading, noBlock).length > 0, "shape problems must be reported as findings");
});

test("planted violation: a duplicated heading is reported rather than scanned ambiguously", () => {
  const twice = sourceConstraints("## Constraints\n\n- **Alpha**: x.\n\n## Constraints\n\n- **Beta**: y.\n");
  assert.equal(twice.bullets.length, 0);
  assert.match(twice.problems.join(" "), /appears more than once/);
});
