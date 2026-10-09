// The c64-testing script: runs a scenario on the original and then on the
// rebuild in one emulator, and prints PASS, FAIL or INCONCLUSIVE with the
// differences. Exit status: 0 PASS, 1 FAIL, 3 INCONCLUSIVE, 2 a bad call.

import { parseArgs } from "node:util";

import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readScenario, runScenario, ScenarioError, type ScenarioResult } from "./scenario.ts";

const USAGE = `test.ts <scenario.json>

<scenario.json> is a scenario file relative to the project directory. See
references/scenario-format.md. The result is one JSON object.`;

const EXIT = { PASS: 0, FAIL: 1, INCONCLUSIVE: 3 } as const;

class UsageError extends Error {}

async function run(argv: string[]): Promise<ScenarioResult> {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { help: { type: "boolean" } } });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one scenario file");
  try {
    return await runScenarioFile(positionals[0]!);
  } catch (error) {
    // A scenario or symbol file that is not usable is a bad call.
    if (error instanceof ScenarioError) throw new UsageError(error.message);
    throw error;
  }
}

async function runScenarioFile(path: string): Promise<ScenarioResult> {
  const scenario = readScenario(path);
  let client: ViceSessionClient;
  try {
    client = await ViceSessionClient.open({ videoStandard: scenario.videoStandard ?? "pal" });
  } catch (error) {
    if (!(error instanceof WireFailure)) throw error;
    return { result: "INCONCLUSIVE", scenario: scenario.name, reason: `no emulator: ${error.message}`, checkpoints: [], differences: [] };
  }
  try {
    return await runScenario(client, scenario);
  } finally {
    await client.close();
  }
}

try {
  const result = await run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = EXIT[result.result];
} catch (error) {
  if (error instanceof UsageError || (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    const message = (error as Error).message;
    process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: message === "" ? USAGE : `${message}\n\n${USAGE}` } })}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
