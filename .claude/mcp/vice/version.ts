// The ONE authoritative implementation of this project's version-resolution
// algorithm (D-5). Before this file existed the repo carried FOUR
// hand-maintained version strings and none of them were true:
// `.claude/mcp/vice/package.json` and `installer/package.json` were stale
// placeholders CI never touched between releases, `.claude-plugin/plugin.json`
// was bumped by NO automation at all, and `vice-proxy.ts`'s own
// `PROXY_VERSION` literal -- advertised to every MCP client over
// `initialize` -- sat twelve patches behind npm's actual `latest`. This file
// exists so there is exactly one place that (a) parses the repo-root
// `VERSION` template, (b) resolves it against a published version per D-2's
// four rules, and (c) answers "what version am I, right now, at runtime"
// (D-4) -- every other consumer (the CLI in `scripts/version.mjs`,
// `vice-proxy.ts`'s `PROXY_VERSION`, CI's `release-on-merge` job) calls INTO
// this module rather than re-deriving any part of the algorithm locally.
//
// Do NOT reimplement the resolution rules (`pinned` / `no-published` /
// `prefix-differs` / `prefix-matches`) anywhere else in this repo -- not in
// `scripts/version.mjs`, not in CI YAML, not in `installer/bin/cli.mjs`.
// `version.test.ts`'s "single-implementation guard" test greps
// `scripts/version.mjs` for the rule literals to catch exactly that
// regression.
//
// Do NOT import `repo-root.ts` from this file. That module's `repoRoot()`
// carries a documented side effect (`ensureResourcesInstalled()`, fired at
// module-load time) this seam must never trigger just by being imported --
// `scripts/version.mjs` and any future test that imports this module for
// its pure functions alone would otherwise deploy host launcher resources as
// a side effect of asking what version something is. Per this repo's own
// convention (see `hostpath.ts`/`containerpath.ts`), the workspace root
// arrives here as an explicit argument (`readTemplate(repoRootDir)`) or a
// caller-supplied lazy thunk (`runtimeVersion({ repoRoot })`), never as an
// import this module resolves itself.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The single self-evident placeholder every derived, publishable version
 * string (the two npm package.json `.version` fields, the installer's
 * `@henols/vice-mcp` dependency pin, and the three plugin-manifest version
 * fields) carries in the working tree (R-2). Valid semver -- `npm pack`
 * accepts it -- but unmistakably not a release. Overwritten at publish time
 * by `npm version` (npm packages) or `scripts/version.mjs stamp` (plugin
 * manifests); never hand-edited. */
export const DEV_PLACEHOLDER = "0.0.0-dev";

export type ResolveRule = "pinned" | "no-published" | "prefix-differs" | "prefix-matches";

export interface ResolveResult {
  version: string;
  rule: ResolveRule;
  template: string;
  published: string | null;
}

// Leading zeros are rejected (bare "0" is the only zero-value exception) --
// SemVer 2.0.0 SS2 forbids leading-zero numeric identifiers, and this
// component is echoed VERBATIM into the resolved string for literal (non-`-`)
// slots, so "1.00.0" must be rejected here rather than surfacing later as an
// npm-publish-time failure (MED-2).
const TEMPLATE_COMPONENT = /^(0|[1-9]\d*|-)$/;

/**
 * Parse a version TEMPLATE (not a resolved version) into its three
 * dot-separated components. Each component must be either a non-negative
 * integer literal or the literal string `-` (an auto-managed slot, D-2).
 * Throws on anything else: wrong component count, a non-numeric/non-`-`
 * component, a blank/whitespace-only string, OR a literal component
 * appearing after a `-` component (MED-1) -- D-2's "literal prefix" wording,
 * and every row of CONTEXT.md's worked-example table, only ever describe
 * dashes trailing literals, never leading or interleaved. A shape like
 * "-.2.3" or "0.-.2" has no defined resolution semantics and must be
 * rejected at the one seam that owns validating the hand-edited VERSION
 * file, not silently resolved into something CONTEXT.md never specified.
 */
export function parseTemplate(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error(`version.ts: malformed template ${JSON.stringify(raw)} -- empty`);
  }
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `version.ts: malformed template ${JSON.stringify(raw)} -- expected exactly 3 dot-separated components, got ${parts.length}`
    );
  }
  let sawDash = false;
  for (const part of parts) {
    if (part === "-") {
      sawDash = true;
      continue;
    }
    if (sawDash) {
      throw new Error(
        `version.ts: malformed template ${JSON.stringify(raw)} -- literal component ${JSON.stringify(part)} cannot follow a "-" component; dashes only trail literals (D-2)`
      );
    }
    if (!TEMPLATE_COMPONENT.test(part)) {
      throw new Error(
        `version.ts: malformed template ${JSON.stringify(raw)} -- component ${JSON.stringify(part)} is neither an integer (no leading zeros) nor "-"`
      );
    }
  }
  return parts;
}

/**
 * Parse a PUBLISHED version string into a 3-tuple of numbers, stripping any
 * `-prerelease` / `+build` suffix first. Returns null (never throws) when
 * the input is null, not parseable, or does not have exactly 3 numeric
 * dot-separated components -- callers treat null exactly like "nothing is
 * published" (D-2 rule 4).
 */
function parsePublished(published: string | null): number[] | null {
  if (published == null) return null;
  const core = published.split(/[-+]/, 1)[0];
  const parts = core.split(".");
  if (parts.length !== 3) return null;
  // Strict plain-decimal-digit validation (MED-4) -- deliberately NOT
  // `Number(p)` + `Number.isInteger`, which also accepts hex-like literals
  // ("0x2" -> 2), exponential notation ("5e2" -> 500), and whitespace-padded
  // numbers. Those would silently coerce malformed `--published` input or an
  // unexpected `npm view` response into a number that doesn't reflect the
  // original text; this must instead fall back to null (== "no-published",
  // D-2 rule 4) exactly like any other unparseable input, matching the
  // strict digit validation `parseTemplate`'s `TEMPLATE_COMPONENT` already
  // uses for the same kind of input.
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  return parts.map((p) => Number(p));
}

/**
 * The D-2 resolution algorithm, in full. `template` must already be
 * well-formed (call `parseTemplate` first, or pass through unchanged --
 * this function calls it internally so a malformed template always throws
 * here too). `published` is the raw published-version string (or null);
 * this function does its own stripping/parsing via `parsePublished`.
 */
export function resolveVersion(template: string, published: string | null): ResolveResult {
  const components = parseTemplate(template);

  if (!components.includes("-")) {
    return { version: components.join("."), rule: "pinned", template, published };
  }

  const pub = parsePublished(published);

  if (pub === null) {
    const resolved = components.map((c) => (c === "-" ? "0" : c));
    return { version: resolved.join("."), rule: "no-published", template, published };
  }

  const prefixMatches = components.every((c, i) => c === "-" || Number(c) === pub[i]);

  if (!prefixMatches) {
    const resolved = components.map((c) => (c === "-" ? "0" : c));
    return { version: resolved.join("."), rule: "prefix-differs", template, published };
  }

  let firstDashSeen = false;
  const resolved = components.map((c, i) => {
    if (c !== "-") return c;
    if (!firstDashSeen) {
      firstDashSeen = true;
      return String(pub[i] + 1);
    }
    return "0";
  });
  return { version: resolved.join("."), rule: "prefix-matches", template, published };
}

/**
 * Compare two plain, fully-resolved (no `-`, no prerelease) semver-shaped
 * version strings as a numeric 3-tuple. Returns -1/0/1. Throws if either
 * side does not parse as 3 numeric components -- this is for comparing
 * RESOLVED versions, not templates.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parsePublished(a);
  const pb = parsePublished(b);
  if (pa === null) throw new Error(`version.ts: compareVersions() cannot parse ${JSON.stringify(a)}`);
  if (pb === null) throw new Error(`version.ts: compareVersions() cannot parse ${JSON.stringify(b)}`);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/**
 * Read `<repoRootDir>/VERSION`, trimmed. Returns null (never throws) when
 * the file does not exist. Does NOT validate the template shape --
 * `resolveVersion`/`parseTemplate` do that; this function's only job is the
 * filesystem read.
 */
export function readTemplate(repoRootDir: string): string | null {
  const path = join(repoRootDir, "VERSION");
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

export interface RuntimeVersionOptions {
  pkgJsonPath?: string;
  /** LAZY -- see this file's header and the precedence note below. Only
   * called when `pkgJsonPath`'s own version is absent or is
   * DEV_PLACEHOLDER, so a published tarball (which has a real version and
   * no repo-root VERSION file) never calls this and never risks the
   * stderr note `repoRoot()` implementations may emit. */
  repoRoot?: () => string | undefined;
}

/**
 * D-4's runtime precedence, synchronous and never throwing:
 *
 *   1. `pkgJsonPath`'s own `.version`, when present and not DEV_PLACEHOLDER
 *      -- the published-tarball path: `npm version` already stamped it.
 *   2. Otherwise call `opts.repoRoot?.()` and, if it yields a directory,
 *      read that directory's `VERSION` template. A pinned template (no `-`)
 *      returns verbatim; a template containing `-` resolves every `-` to 0
 *      and appends a `-dev` prerelease tag, so a dev checkout never claims
 *      to be a release build.
 *   3. Otherwise DEV_PLACEHOLDER.
 *
 * The whole body is wrapped in try/catch: any unexpected failure (a
 * malformed package.json, a repoRoot() thunk that throws, a malformed
 * VERSION template) degrades to DEV_PLACEHOLDER rather than crashing the
 * caller -- this is the one runtime-facing entry point in this file, and a
 * standalone MCP server must never fail to start over a version string.
 */
export function runtimeVersion(opts: RuntimeVersionOptions = {}): string {
  try {
    if (opts.pkgJsonPath) {
      try {
        const raw = readFileSync(opts.pkgJsonPath, "utf8");
        const pkg = JSON.parse(raw) as { version?: unknown };
        if (typeof pkg.version === "string" && pkg.version.length > 0 && pkg.version !== DEV_PLACEHOLDER) {
          return pkg.version;
        }
      } catch {
        // No readable/parseable package.json at pkgJsonPath -- fall through.
      }
    }

    const root = opts.repoRoot?.();
    if (root) {
      const template = readTemplate(root);
      if (template) {
        const components = parseTemplate(template);
        if (!components.includes("-")) {
          return components.join(".");
        }
        const resolved = components.map((c) => (c === "-" ? "0" : c));
        return `${resolved.join(".")}-dev`;
      }
    }
  } catch {
    // Degrade to the placeholder below -- see this function's own doc
    // comment for why nothing here may throw.
  }

  return DEV_PLACEHOLDER;
}
