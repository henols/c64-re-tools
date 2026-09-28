#!/usr/bin/env node
// test-corpus.ts
//
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
import { existsSync } from "node:fs";
import { join } from "node:path";

import { projectRoot } from "../../../skills/c64-project/scripts/project-paths.ts";
import { loadRegistry } from "../../../skills/c64-project/scripts/releases.ts";
import type { Registry } from "../../../skills/c64-project/scripts/releases.ts";

/** The per-dump file fields a registry entry names. */
type DumpFileField = "bin" | "capture_record" | "chip_state" | "range_manifest";

/** One dump file located through the registry. */
export interface DumpArtifact {
  release: string;
  label: string;
  path: string;
}

/**
 * First dump in the registry whose `field` names a file that exists, as
 * `{ release, label, path }` -- or null when the registry is absent, empty, or
 * names nothing on disk. Never throws: a missing registry is a skip, not a
 * failure.
 */
export function firstDumpArtifact(field: DumpFileField): DumpArtifact | null {
  let reg: Registry;
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
export function allDumpArtifacts(field: DumpFileField): DumpArtifact[] {
  let reg: Registry;
  try {
    reg = loadRegistry();
  } catch {
    return [];
  }
  const out: DumpArtifact[] = [];
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

/**
 * node:test `skip` value: `false` to run, or a human-readable reason string.
 * Pass the thing you looked for so a skipped run explains itself.
 */
export function skipUnless(found: unknown, what: string): false | string {
  if (found && (!Array.isArray(found) || found.length > 0)) return false;
  return `no ${what} found via this project's registry -- corpus-dependent check skipped`;
}
