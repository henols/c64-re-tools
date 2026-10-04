// The c64-testing playtest checklist: a Markdown list for a human tester,
// made from the scenarios' checkpoints and the behavior that automated
// scenarios cannot check (13 §15). Nothing is stored.

import { parseArgs } from "node:util";

import { readScenario, ScenarioError } from "./scenario.ts";

const USAGE = `checklist.ts <scenario.json> [<scenario.json> ...] [--item <text> ...]

Prints a Markdown checklist. --item adds an application-specific line.`;

/** Behavior that only a person can judge (13 §15). */
const ALWAYS = [
  "The controls respond as fast as in the original.",
  "The animation is smooth and has no glitches.",
  "The music and the sound effects sound the same as in the original.",
  "The game flow and the level changes work from start to end.",
  "Nothing unexpected happens outside the tested scenarios.",
];

function run(argv: string[]): string {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { item: { type: "string", multiple: true }, help: { type: "boolean" } } });
  if (values.help || positionals.length === 0) throw new ScenarioError(USAGE);
  const lines = ["# Playtest checklist", ""];
  for (const path of positionals) {
    const scenario = readScenario(path);
    lines.push(`## ${scenario.name}`, "");
    for (const step of scenario.steps) if ("observe" in step) lines.push(`- [ ] At "${step.observe}", the rebuild looks and behaves as the original.`);
    lines.push("");
  }
  lines.push("## Application", "");
  for (const item of values.item ?? []) lines.push(`- [ ] ${item}`);
  for (const item of ALWAYS) lines.push(`- [ ] ${item}`);
  return `${lines.join("\n")}\n`;
}

try {
  process.stdout.write(run(process.argv.slice(2)));
} catch (error) {
  if (error instanceof ScenarioError || (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: (error as Error).message } })}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
