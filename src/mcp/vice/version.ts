// Answers one question: what version is this server, right now, at runtime.
//
// WHY THIS FILE EXISTS: `vice-proxy.ts` advertises a version to every MCP
// client over `initialize`. That string used to be a hand-maintained
// `PROXY_VERSION` literal and it sat twelve patches behind npm's actual
// `latest`, because nothing bumped it. One function now derives it from the
// package.json that ships beside the code, so it cannot drift again.
//
// This file once also carried a bespoke version-RESOLUTION algorithm (a
// `VERSION` template parsed against the published version under four named
// rules) used only by the auto-patch-on-merge release job. That job and its
// template are gone: the git tag is the version now, and the publish workflow
// reads it straight from the ref. Do not reintroduce a second version
// algorithm here -- if you need to know what a release will be called, look
// at the tag.
//
// Do NOT import `repo-root.ts` from this file, and do not reintroduce a
// `repoRoot` option. That module's `repoRoot()` fires
// `ensureResourcesInstalled()` at module-load time, and asking what version
// something is must never deploy host launcher resources as a side effect.
// The option existed to locate a `VERSION` template that no longer exists.
import { readFileSync } from "node:fs";

/** The placeholder both publishable `package.json` `.version` fields carry in
 * the working tree. Valid semver -- `npm pack` accepts it -- but unmistakably
 * not a release. `npm version` overwrites it at publish time from the git tag;
 * never hand-edited. */
export const DEV_PLACEHOLDER = "0.0.0-dev";

export interface RuntimeVersionOptions {
  /** Path to the `package.json` shipped beside the running code. */
  pkgJsonPath?: string;
}

/**
 * Runtime precedence, synchronous and never throwing:
 *
 *   1. `pkgJsonPath`'s own `.version`, when present and not DEV_PLACEHOLDER
 *      -- the published-tarball path: `npm version` stamped it from the git
 *      tag at publish time.
 *   2. Otherwise DEV_PLACEHOLDER, which is what a git checkout reports.
 *
 * The body is wrapped in try/catch: a missing or malformed package.json
 * degrades to DEV_PLACEHOLDER rather than crashing the caller. This is the
 * one runtime-facing entry point in this file, and a standalone MCP server
 * must never fail to start over a version string.
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
  } catch {
    // Degrade to the placeholder below -- see this function's own doc
    // comment for why nothing here may throw.
  }

  return DEV_PLACEHOLDER;
}
