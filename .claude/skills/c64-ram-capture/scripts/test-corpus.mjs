// Locates committed artifacts through the registry, so tests exercise whatever
// corpus the host project actually has instead of naming one project's files.
//
// The point is portability without losing coverage: a project with captures gets
// the real-artifact assertions; a project with none gets them skipped, not
// failed. Hardcoding `recovery/<some-release>/dumps/<some-label>.state.json`
// meant this toolkit's tests could only ever pass in the repo they were written
// in, which is the opposite of shippable.
//
// Test-support only. Pure filesystem reads; contacts nothing.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoot } from "./project-paths.mjs";
import { loadRegistry } from "./releases.mjs";

/**
 * First dump in the registry whose `field` names a file that exists, as
 * `{ release, label, path }` -- or null when the registry is absent, empty, or
 * names nothing on disk. Never throws: a missing registry is a skip, not a
 * failure.
 */
export function firstDumpArtifact(field) {
  let reg;
  try {
    reg = loadRegistry();
  } catch {
    return null;
  }
  for (const r of reg.releases ?? []) {
    for (const d of r.dumps ?? []) {
      const value = d[field];
      if (!value) continue;
      const path = join(projectRoot(), value);
      if (existsSync(path)) return { release: r.id, label: d.label, path };
    }
  }
  return null;
}

/** Every dump in the registry whose `field` names an existing file. */
export function allDumpArtifacts(field) {
  let reg;
  try {
    reg = loadRegistry();
  } catch {
    return [];
  }
  const out = [];
  for (const r of reg.releases ?? []) {
    for (const d of r.dumps ?? []) {
      const value = d[field];
      if (!value) continue;
      const path = join(projectRoot(), value);
      if (existsSync(path)) out.push({ release: r.id, label: d.label, path });
    }
  }
  return out;
}

/** Parsed JSON for a `firstDumpArtifact` hit, or null. */
export function readJsonArtifact(field) {
  const hit = firstDumpArtifact(field);
  if (!hit) return null;
  return { ...hit, json: JSON.parse(readFileSync(hit.path, "utf8")) };
}

/**
 * node:test `skip` value: `false` to run, or a human-readable reason string.
 * Pass the thing you looked for so a skipped run explains itself.
 */
export function skipUnless(found, what) {
  if (found && (!Array.isArray(found) || found.length > 0)) return false;
  return `no ${what} found via this project's registry -- corpus-dependent check skipped`;
}
