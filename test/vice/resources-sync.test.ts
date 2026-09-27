// resources-sync.test.ts
//
// resources/ is build output that is committed (Phase 01.6 plan 01). The
// host runs it with `node` alone, so this test checks that no generated
// file under resources/ imports a bare package specifier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VICE_DIR } from "./paths.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = join(VICE_DIR, "resources");

/** Extensions a `tsc` build can ever emit under this project's tsconfig --
 * `.mjs` today (module: nodenext, host-bound .mts sources), extended here
 * (not with a fresh hardcoded list elsewhere) the day a second emit
 * extension joins it. Anything under resources/ with one of these
 * extensions is claimed as "generated" for the purposes of this test;
 * everything else (the shell scripts, lib/) is hand-authored and outside
 * the checked set. */
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
