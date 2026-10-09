// The c64-testing playtest checklist: a Markdown list for a human tester,
// made from the scenarios' checkpoints and the behavior that automated
// scenarios cannot check. Nothing is stored.

import { parseArgs } from "node:util";

import { runScript, UsageError } from "#src/script.ts";
import { readScenario, ScenarioError, type Scenario } from "./scenario.ts";

const USAGE = `checklist.ts <scenario.json> [<scenario.json> ...] [--item <text> ...]

Prints a Markdown checklist. --item adds an application-specific line.`;

/** Behavior that only a person can judge. */
const ALWAYS = [
  "The controls respond as fast as in the original.",
  "The animation is smooth and has no glitches.",
  "The music and the sound effects sound the same as in the original.",
  "The game flow and the level changes work from start to end.",
  "Nothing unexpected happens outside the tested scenarios.",
];

function run(argv: string[]): string {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { item: { type: "string", multiple: true }, help: { type: "boolean" } } });
  if (values.help) throw new UsageError("");
  if (positionals.length === 0) throw new UsageError("give at least one scenario file");
  const lines = ["# Playtest checklist", ""];
  for (const path of positionals) {
    let scenario: Scenario;
    try {
      scenario = readScenario(path);
    } catch (error) {
      if (error instanceof ScenarioError) throw new UsageError(error.message);
      throw error;
    }
    lines.push(`## ${scenario.name}`, "");
    for (const step of scenario.steps) if ("observe" in step) lines.push(`- [ ] At "${step.observe}", the rebuild looks and behaves as the original.`);
    lines.push("");
  }
  lines.push("## Application", "");
  for (const item of values.item ?? []) lines.push(`- [ ] ${item}`);
  for (const item of ALWAYS) lines.push(`- [ ] ${item}`);
  return `${lines.join("\n")}\n`;
}

await runScript(
  () => {
    process.stdout.write(run(process.argv.slice(2)));
  },
  { usage: USAGE },
);
