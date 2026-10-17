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

/** The name, version and dist-tag of this npm package, and the Node.js major version that its engines field requires. */
export const PACKAGE = (() => {
  const metadata = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as { name: string; version: string; engines?: { node?: string } };
  const nodeMajor = Number(/(\d+)/.exec(metadata.engines?.node ?? "")?.[1]);
  return { name: metadata.name, version: metadata.version, tag: channelOf(metadata.version), nodeMajor: Number.isInteger(nodeMajor) ? nodeMajor : undefined };
})();

/**
 * The refusal for a Node.js older than `required`, or undefined. An older Node.js
 * cannot run the skill scripts: they are TypeScript and use node:sqlite.
 */
export function oldNodeRefusal(version: string = process.versions.node, required: number | undefined = PACKAGE.nodeMajor): string | undefined {
  if (required === undefined || Number(version.split(".")[0]) >= required) return undefined;
  return `c64-re-tools needs Node.js ${required} or newer, and this is Node.js ${version}. Install Node.js ${required} from https://nodejs.org/ and run the command again.`;
}
