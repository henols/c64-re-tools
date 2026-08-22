// resources-sync.test.ts
//
// Closes criterion 3's second half (Phase 01.6 plan 01, task 3): resources/
// has just stopped being authored source and become build output that
// happens to be committed. This test makes a stale committed build a test
// FAILURE rather than a silent bad deploy -- the exact scenario criterion 3
// exists to prevent (developer edits .mts, forgets to rebuild, commits the
// stale resources/ tree).
//
// Drives the SAME build() entry point task 2's build.ts exports, through its
// out-directory flag, into a scratch mkdtempSync(tmpdir()) directory -- the
// banner text must never exist in two implementations, so this test never
// re-derives it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = join(HERE, "resources");

/** Extensions a `tsc` build can ever emit under this project's tsconfig --
 * `.mjs` today (module: nodenext, host-bound .mts sources), extended here
 * (not with a fresh hardcoded list elsewhere) the day a second emit
 * extension joins it. Anything under resources/ with one of these
 * extensions is claimed as "generated" for the purposes of this test's
 * orphan check; everything else (the shell scripts, lib/) is hand-authored
 * and outside the comparison set BY CONSTRUCTION -- the comparison set is
 * what build() emits, never a directory walk. */
const GENERATED_EXTENSIONS = [".mjs"];

function walk(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${dirent.name}` : dirent.name;
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...walk(abs, rel));
    } else if (dirent.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

test("resources/ is byte-identical to a fresh build of its TypeScript source", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "resources-sync-"));
  try {
    build({ outDir: scratchDir });

    const scratchFiles = walk(scratchDir).sort();
    assert.ok(scratchFiles.length > 0, "scratch build produced no files -- build() is broken, not resources/");

    // Direction 1: every file the scratch build produced exists at the same
    // relative path under the committed resources/, byte-identical. Catches
    // "the .mts source changed and resources/ was never rebuilt".
    for (const rel of scratchFiles) {
      const committedPath = join(RESOURCES_DIR, rel);
      const scratchContent = readFileSync(join(scratchDir, rel));
      let committedContent: Buffer;
      try {
        committedContent = readFileSync(committedPath);
      } catch {
        assert.fail(`committed resources/${rel} is missing but a fresh build produces it -- rebuild and commit`);
        return;
      }
      assert.ok(
        scratchContent.equals(committedContent),
        `committed resources/${rel} does not match a fresh build of its TypeScript source -- ` +
          "the committed tree is STALE. Run `node build.ts` and commit the result."
      );
    }

    // Direction 2: every already-committed file under resources/ bearing a
    // generated extension was produced by the scratch build. Catches an
    // ORPHAN -- a generated file whose .mts source was deleted, so it can
    // never be reproduced by build() again.
    const committedGenerated = walk(RESOURCES_DIR)
      .filter((rel) => GENERATED_EXTENSIONS.some((ext) => rel.endsWith(ext)))
      .sort();
    for (const rel of committedGenerated) {
      assert.ok(
        scratchFiles.includes(rel),
        `committed resources/${rel} carries a generated extension but a fresh build does not produce it -- ` +
          "it is an ORPHAN (its TypeScript source was likely deleted) and must be removed from resources/."
      );
    }
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});

test("no generated file under resources/ names an import specifier that is neither a node: builtin nor a relative path", () => {
  // Criterion 3's host clause, made mechanical: the host needs `node` and
  // never `npm`, so a bare package specifier reaching the deployed tree is
  // exactly the failure it forbids. This is what makes a bundler
  // unnecessary for the HOST -- whether to bundle for the CONTAINER's
  // benefit is Phase 01.6.3's D-06 decision, not this test's business.
  const IMPORT_SPECIFIER = /(?:import\s[^;]*?from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

  const generated = walk(RESOURCES_DIR).filter((rel) => GENERATED_EXTENSIONS.some((ext) => rel.endsWith(ext)));
  assert.ok(generated.length > 0, "no generated files found under resources/ -- resolution is broken");

  const offenders: string[] = [];
  for (const rel of generated) {
    const text = readFileSync(join(RESOURCES_DIR, rel), "utf8");
    for (const match of text.matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1];
      const isNodeBuiltin = specifier.startsWith("node:");
      const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
      if (!isNodeBuiltin && !isRelative) {
        offenders.push(`${rel}: "${specifier}"`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `bare (non-node:, non-relative) import specifier found in generated host-bound output: ${JSON.stringify(offenders)} -- ` +
      "the host needs `node` and never `npm`; this is why a bundler is unnecessary for the host."
  );
});
