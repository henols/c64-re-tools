// The version of c64-re-tools lives in package.json; the Claude Code plugin
// manifests repeat it. `sync` copies it into them, `check` fails when one
// differs. The release workflow bumps package.json with npm version and then
// runs sync, so every manifest carries the version it publishes.
//
//   node distribution/version.ts sync|check

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The files that repeat the package version, relative to the repository root. */
export const MANIFESTS = [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"];

const VERSION_FIELD = /("version"\s*:\s*")([^"]*)(")/g;

/** Every version that a manifest's text names, in order. */
export function versionsIn(text: string): string[] {
  return [...text.matchAll(VERSION_FIELD)].map((match) => match[2]!);
}

/** `text` with every "version" field set to `version`; the rest of the file stays as it is. */
export function withVersion(text: string, version: string): string {
  return text.replace(VERSION_FIELD, (_match, start: string, _old: string, end: string) => `${start}${version}${end}`);
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

export function sync(root: string): void {
  const version = packageVersion(root);
  for (const file of MANIFESTS) writeFileSync(join(root, file), withVersion(readFileSync(join(root, file), "utf8"), version));
}

function main(command: string | undefined): number {
  const root = resolve(import.meta.dirname, "..");
  if (command === "sync") {
    sync(root);
    console.log(`Every manifest names ${packageVersion(root)}.`);
    return 0;
  }
  if (command === "check") {
    const wrong = mismatches(root);
    for (const { file, versions } of wrong) console.error(`${file} names ${versions.join(", ") || "no version"}, not ${packageVersion(root)}.`);
    return wrong.length === 0 ? 0 : 1;
  }
  console.error("usage: node distribution/version.ts sync|check");
  return 2;
}

if (import.meta.main) process.exitCode = main(process.argv[2]);
