// The name, version and npm channel of this copy of c64-re-tools, for the npx
// commands that refusals and help texts give. The package.json above src/ is
// the package's own one; in an installed skill it is the skill's one, which
// has the same name and version (distribution/plugin.ts).

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The npm dist-tag that a version is published under: a prerelease
 * (2.0.0-rc.1) goes to "next", a release to "latest".
 */
export function channelOf(version: string): "latest" | "next" {
  return version.includes("-") ? "next" : "latest";
}

/** The name, version and dist-tag of this npm package, from its package.json. */
export const PACKAGE = (() => {
  const metadata = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as { name: string; version: string };
  return { name: metadata.name, version: metadata.version, tag: channelOf(metadata.version) };
})();
