// A release is a tag push: the tag v2.0.0 releases 2.0.0 to npm's latest,
// the tag v2.0.0-rc.2 releases a prerelease to next. The version exists only
// in the published package: the release workflow writes the tag's version
// into package.json and the Claude Code plugin manifests inside the runner,
// and pushes nothing back. The repository keeps a development version.
//
//   node distribution/version.ts tag <v-tag>   set the tag's version; print version= and channel=
//   node distribution/version.ts set <version>
//   node distribution/version.ts check         every manifest names the version of package.json

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { channelOf } from "./package.ts";

/** The files that repeat the package version, relative to the repository root. */
export const MANIFESTS = [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"];

const VERSION_FIELD = /("version"\s*:\s*")([^"]*)(")/g;
const RELEASE_TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;

/** Every version that a manifest's text names, in order. */
export function versionsIn(text: string): string[] {
  return [...text.matchAll(VERSION_FIELD)].map((match) => match[2]!);
}

/** `text` with every "version" field set to `version`; the rest of the file stays as it is. */
export function withVersion(text: string, version: string): string {
  return text.replace(VERSION_FIELD, (_match, start: string, _old: string, end: string) => `${start}${version}${end}`);
}

/**
 * The version and npm dist-tag that a release tag names: v2.0.0 is a release
 * for latest, v2.0.0-rc.2 a prerelease for next. Throws for any other tag.
 */
export function releaseOf(tag: string): { version: string; channel: "latest" | "next" } {
  const match = RELEASE_TAG.exec(tag);
  if (match === null) throw new Error(`${tag} is not a release tag. Use v<major>.<minor>.<patch> for a release or v<major>.<minor>.<patch>-<pre> for a prerelease, for example v2.0.0 or v2.0.0-rc.2.`);
  const version = match[1]!;
  return { version, channel: channelOf(version) };
}

export function packageVersion(root: string): string {
  return (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
}

/** The manifests whose versions differ from package.json, with what they name. */
export function mismatches(root: string): Array<{ file: string; versions: string[] }> {
  const version = packageVersion(root);
  return MANIFESTS.map((file) => ({ file, versions: versionsIn(readFileSync(join(root, file), "utf8")) })).filter(
    ({ versions }) => versions.length === 0 || versions.some((named) => named !== version),
  );
}

/** Writes `version` into package.json and every manifest. */
export function set(root: string, version: string): void {
  for (const file of ["package.json", ...MANIFESTS]) writeFileSync(join(root, file), withVersion(readFileSync(join(root, file), "utf8"), version));
}

function main([command, value]: string[]): number {
  const root = resolve(import.meta.dirname, "..");
  try {
    if (command === "tag" && value !== undefined) {
      const { version, channel } = releaseOf(value);
      set(root, version);
      console.log(`version=${version}\nchannel=${channel}`);
      return 0;
    }
    if (command === "set" && value !== undefined) {
      set(root, value);
      return 0;
    }
    if (command === "check") {
      const wrong = mismatches(root);
      for (const { file, versions } of wrong) console.error(`${file} names ${versions.join(", ") || "no version"}, not ${packageVersion(root)}.`);
      return wrong.length === 0 ? 0 : 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  console.error("usage: node distribution/version.ts tag <v-tag> | set <version> | check");
  return 2;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
