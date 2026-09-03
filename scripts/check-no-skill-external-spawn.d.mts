// Type declarations for check-no-skill-external-spawn.mjs, so the colocated
// test (src/mcp/vice/skill-external-spawn-gate.test.ts) typechecks under
// strict mode. This file is a CI-only helper with no runtime role, so it
// stays out of src/mcp/vice/package.json's files[] like its .mjs sibling,
// mirroring scripts/lib/anno-cli-invocations.d.mts's own convention.

/** One skill-script record the predicate scans: `name` is a route-relative
 * path used only for reporting, `source` is the file's real text. */
export interface SkillScriptFile {
  name: string;
  source: string;
}

/** One reported violation: the file it was found in, the spawn function
 * name, the resolved banned command, and a human-readable reason. */
export interface SkillScriptSpawnViolation {
  file: string;
  fn: string;
  command: string;
  reason: string;
}

/** The distinguished sentinel `skillScriptSpawnViolations()` returns for an
 * empty input list -- never an empty array, so a broken scope cannot read
 * as a clean scan. */
export interface NonVacuityFailure {
  nonVacuityFailure: true;
  message: string;
}

export declare const BANNED_COMMAND_SHAPES: readonly string[];

export declare function skillScriptSpawnViolations(
  files: SkillScriptFile[],
): SkillScriptSpawnViolation[] | NonVacuityFailure;

export declare function skillScriptFilesFromPackedTarball(installerDir?: string): SkillScriptFile[];

export declare function skillScriptFilesFromTrackedTree(repoRoot?: string): SkillScriptFile[];
