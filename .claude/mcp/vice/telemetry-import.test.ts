// Task 3 (01.6.3 plan 01): structural proof that the PostHog telemetry client
// bundled inside @mastra/core@1.55.0 (dist/telemetry/) is never reachable from
// this project's own import graph.
//
// PRIMARY MECHANISM, PER 01.6.3-APPROVALS.md's "ESTABLISHED 2026-08-04"
// SECTION: this file -- a structural, source-text/installed-tree check, in
// the same idiom load-order.test.ts already uses for the repo-root import
// cycle (statement-anchored regex over this project's own sources, plus a
// live check against the resolved node_modules tree). Do NOT rely on
// MASTRA_TELEMETRY_DISABLED as the control: upstream
// https://github.com/mastra-ai/mastra/issues/7813 (open, assigned) reports
// telemetry sent anyway with that variable set, and
// https://github.com/mastra-ai/mastra/issues/6551 asks for a separate
// MASTRA_DISABLE_POSTHOG because of it. .mcp.json's `vice` entry additionally
// sets MASTRA_TELEMETRY_DISABLED=1 as a harmless SECONDARY belt-and-braces
// measure only -- it is not, and must not be treated as, what actually proves
// this property. That is this file's job.
//
// Two complementary checks:
//   Part 1 -- static source-text guard: no .ts/.mts file this project itself
//   authors under .claude/mcp/vice/ ever imports "@mastra/core/telemetry" or
//   a relative "./telemetry" specifier. True today because nothing imports
//   Mastra at all yet (Plan 02 does the seam swap); this guard is what keeps
//   it true after that lands.
//   Part 2 -- live installed-tree guard: re-derive (not hardcode) every
//   @mastra/core subpath the INSTALLED @mastra/mcp package's own entry files
//   reference, resolve each through the real node_modules tree Task 2 just
//   installed, and grep every resolved file for posthog/telemetry markers.
//   APPROVALS.md established this against a pre-install `npm pack` snapshot;
//   this test re-runs the same method against what actually ships in
//   node_modules, since a published tarball and an installed tree are not
//   guaranteed to agree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Part 1: static source-text guard over this project's own .ts/.mts sources.
// ============================================================================

// STATEMENT-ANCHORED, matching load-order.test.ts's own IMPORT_REPO_ROOT_PATTERN
// reasoning exactly: an unanchored search for "@mastra/core/telemetry" would
// match THIS FILE's own header comment above, which quotes forbidden
// specifiers in prose. Anchoring to a real `import` statement start (optional
// leading whitespace, then `import`, optionally `type`, never `//`) excludes
// the comment structurally. `[^;]*?` bounds the lazy match to the current
// statement, the same way load-order.test.ts's pattern does, so it still
// spans multi-line brace-list imports without leaking across an unrelated
// import's own terminator.
const IMPORT_TELEMETRY_PATTERN =
  /^[ \t]*import(?:\s+type)?\s+[^;]*?from\s+["'](?:@mastra\/core\/telemetry|\.\/telemetry)["']/m;

function importsTelemetry(text: string): boolean {
  return IMPORT_TELEMETRY_PATTERN.test(text);
}

test("importsTelemetry(): regression corpus -- catches every import shape of @mastra/core/telemetry and ./telemetry, including type-only and multi-line brace lists; never fires on prose that merely quotes the specifier", () => {
  assert.ok(
    importsTelemetry('import { PostHogTelemetry } from "@mastra/core/telemetry";'),
    "a plain named import of the telemetry subpath must be caught"
  );
  assert.ok(
    importsTelemetry('import type { PostHogTelemetry } from "@mastra/core/telemetry";'),
    "a type-only import must be caught -- erasure making it harmless at runtime is not a reason to allow it structurally"
  );
  assert.ok(
    importsTelemetry('import { type PostHogTelemetry } from "@mastra/core/telemetry";'),
    "a named type-only import must be caught"
  );
  assert.ok(
    importsTelemetry('import { foo } from "./telemetry";'),
    "a relative ./telemetry specifier must be caught -- covers a future vendored copy resolving into the same subpath"
  );
  assert.ok(
    importsTelemetry('import {\n  PostHogTelemetry,\n  something,\n} from "@mastra/core/telemetry";'),
    "a multi-line brace-list import must be caught"
  );
  assert.ok(
    !importsTelemetry(
      '// Do not import from "@mastra/core/telemetry" here -- see this file\'s own header for why.'
    ),
    "prose that merely quotes the forbidden specifier inside a comment must NOT be classified as an import"
  );
  assert.ok(
    !importsTelemetry('import { MCPClient } from "@mastra/mcp";'),
    "an unrelated import of the adopted package itself must not false-positive"
  );
  assert.ok(
    !importsTelemetry('import { Agent } from "@mastra/core/agent";'),
    "an import of a DIFFERENT @mastra/core subpath must not false-positive"
  );
});

/** Flat .ts/.mts source files directly under this directory, test files
 * excluded -- matches load-order.test.ts's listModuleFiles() convention
 * (this module tree is flat, no subdirectory siblings import each other). */
function listSourceFiles(): string[] {
  return readdirSync(HERE, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((name) => /\.(ts|mts)$/.test(name))
    .filter((name) => !name.includes(".test."));
}

test("structural guard: no .ts/.mts source file in .claude/mcp/vice/ imports @mastra/core/telemetry or ./telemetry, in any form", () => {
  const files = listSourceFiles();
  assert.ok(
    files.length > 0,
    "source enumeration returned nothing -- path resolution is broken, not a real pass"
  );
  for (const name of files) {
    const text = readFileSync(join(HERE, name), "utf8");
    assert.ok(
      !importsTelemetry(text),
      `${name}: imports @mastra/core/telemetry (or ./telemetry). This project's whole import graph must ` +
        "never reach the PostHog telemetry client -- see 01.6.3-APPROVALS.md's \"ESTABLISHED 2026-08-04\" " +
        "section. MASTRA_TELEMETRY_DISABLED is documented upstream as unreliable " +
        "(mastra-ai/mastra#7813), so this structural check is the primary guarantee, not the env var " +
        "set in .mcp.json."
    );
  }
});

// ============================================================================
// Part 2: live installed-tree guard. Re-derives (does not hardcode) every
// @mastra/core subpath @mastra/mcp's OWN installed entry files reference,
// resolves each through the real node_modules tree, and greps the resolved
// file for telemetry markers. A future @mastra/mcp release that starts
// importing @mastra/core/telemetry -- or any new subpath that itself pulls
// posthog-node in -- fails this test automatically; nothing here needs to be
// told in advance which subpaths exist.
// ============================================================================

const CORE_SUBPATH_PATTERN = /@mastra\/core\/[a-zA-Z0-9_\-/]+/g;

/** Every distinct "@mastra/core/xxx" specifier string found anywhere in
 * `text` (bundled/minified source, so this is a substring scan rather than a
 * statement-anchored one -- Part 1 above is the statement-anchored guard over
 * OUR OWN sources; this part is scanning THIRD-PARTY bundled output where
 * import statements no longer exist as such after bundling). */
function extractCoreSubpaths(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(CORE_SUBPATH_PATTERN)) out.add(m[0]);
  return out;
}

test("extractCoreSubpaths(): regression corpus -- finds every distinct @mastra/core/x specifier embedded in bundled text, ignores unrelated strings", () => {
  assert.deepEqual(
    [...extractCoreSubpaths('require("@mastra/core/agent");require("@mastra/core/mcp")')].sort(),
    ["@mastra/core/agent", "@mastra/core/mcp"],
    "must find both distinct specifiers regardless of quoting/require form"
  );
  assert.deepEqual(
    [...extractCoreSubpaths('from"@mastra/core/agent"')].sort(),
    ["@mastra/core/agent"],
    "must find a minified ESM from-clause with no surrounding whitespace"
  );
  assert.deepEqual(
    [...extractCoreSubpaths('require("@mastra/core/agent");require("@mastra/core/agent")')],
    ["@mastra/core/agent"],
    "must dedupe repeated occurrences of the same specifier"
  );
  assert.deepEqual([...extractCoreSubpaths("no mastra references here at all")], []);
});

const TELEMETRY_MARKER_PATTERN = /posthog|usage-telemetry|\/telemetry/i;

test("TELEMETRY_MARKER_PATTERN: regression corpus -- fires on posthog/usage-telemetry/telemetry markers, not on unrelated text", () => {
  assert.ok(TELEMETRY_MARKER_PATTERN.test('require("posthog-node")'));
  assert.ok(TELEMETRY_MARKER_PATTERN.test("PostHog"), "case-insensitive match required");
  assert.ok(TELEMETRY_MARKER_PATTERN.test("usage-telemetry-client"));
  assert.ok(TELEMETRY_MARKER_PATTERN.test('require("@mastra/core/telemetry")'));
  assert.ok(!TELEMETRY_MARKER_PATTERN.test('require("@mastra/core/agent")'));
  assert.ok(!TELEMETRY_MARKER_PATTERN.test("nothing telemetry-related in here besides this word: teleport"));
});

/** @mastra/mcp's own installed entry files -- both the ESM and CJS build
 * outputs, since which one loads depends on the importing package's own
 * "type" field and this check should not depend on that happening to be
 * "module" today. Missing entries are reported by the caller, not silently
 * skipped, since an empty list here would make the live guard below
 * vacuously pass. */
function mastraMcpEntryFiles(): string[] {
  const distDir = join(HERE, "node_modules", "@mastra", "mcp", "dist");
  return ["index.js", "index.cjs"].map((name) => join(distDir, name)).filter((p) => existsSync(p));
}

test("live installed tree: every @mastra/core subpath @mastra/mcp's installed entry files reference resolves to a file with zero posthog/usage-telemetry/telemetry markers", () => {
  const entries = mastraMcpEntryFiles();
  assert.ok(
    entries.length > 0,
    "no @mastra/mcp dist entry found under node_modules/@mastra/mcp/dist/{index.js,index.cjs} -- " +
      "Task 2's `npm install --prefix .claude/mcp/vice` must run before this test; an empty entry list " +
      "would make every assertion below vacuously pass, which is exactly the false-negative this test " +
      "exists to prevent."
  );

  const req = createRequire(join(HERE, "package.json"));
  const subpaths = new Set<string>();
  for (const entry of entries) {
    for (const specifier of extractCoreSubpaths(readFileSync(entry, "utf8"))) subpaths.add(specifier);
  }

  assert.ok(
    subpaths.size > 0,
    "extracted zero @mastra/core subpath specifiers from @mastra/mcp's installed entry files -- " +
      "extraction is broken (or @mastra/mcp stopped depending on @mastra/core, which would itself be " +
      "worth investigating), not a real pass."
  );
  assert.ok(
    !subpaths.has("@mastra/core/telemetry"),
    "@mastra/mcp's installed entry file directly references @mastra/core/telemetry -- the telemetry " +
      "client IS reachable from this project's import graph. 01.6.3-APPROVALS.md's \"not reachable via " +
      "the nine imported subpaths\" finding no longer holds for the installed version; this must be " +
      "re-escalated to the developer, not silently accepted."
  );

  for (const specifier of subpaths) {
    const resolved = req.resolve(specifier);
    const text = readFileSync(resolved, "utf8");
    assert.ok(
      !TELEMETRY_MARKER_PATTERN.test(text),
      `${specifier} (resolved to ${resolved}) contains a posthog/usage-telemetry/telemetry marker. This ` +
        "project's import graph reaches the PostHog client through a subpath APPROVALS.md's original " +
        "nine-subpath check did not find carrying one. Escalate: the \"not reachable\" finding no longer " +
        "holds for the installed tree."
    );
  }
});
