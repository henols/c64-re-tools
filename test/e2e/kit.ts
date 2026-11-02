// Helpers of the end-to-end tests that run the skill scripts.

import assert from "node:assert/strict";

import { runScriptSync, skillScript, type ScriptOptions } from "../kit.ts";

/** Runs the script `file` of `skill` as runScriptSync does, and gives its body: the script must answer ok:true. */
export function scriptBody(skill: string, file: string, args: readonly string[], options: ScriptOptions): any {
  const run = runScriptSync(skillScript(skill, file), args, options);
  assert.equal(run.status, 0, `${file} ${args.join(" ")}: ${JSON.stringify(run.json)}`);
  return run.json;
}
