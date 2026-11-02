// The project folder of the c64-testing tests that need no emulator.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach } from "node:test";

import { prg } from "../../src/c64.testkit.ts";
import { scratchDir } from "../kit.ts";

/**
 * A scratch project with game.prg (one byte at $0801). Each test of the file
 * runs in it, as the paths of run, scenario and record files are relative to
 * the working directory.
 */
export function testingProject(prefix: string): string {
  const project = scratchDir(prefix);
  writeFileSync(join(project, "game.prg"), prg(0x0801, [0x00]));
  const home = process.cwd();
  beforeEach(() => process.chdir(project));
  afterEach(() => process.chdir(home));
  return project;
}
