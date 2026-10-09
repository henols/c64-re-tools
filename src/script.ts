// The one error envelope for the skill scripts and the CLI: a script prints one JSON line,
// a refusal prints {"error":{code,message}} with exit status 1, and a usage error prints the
// usage text as an invalid-input error with exit status 2.

import { WireFailure } from "./protocol/messages.ts";
import { elapsedMs, startTrace, trace, type TraceFields } from "./trace.ts";

/** A wrong command line. The message names the problem; an empty message asks for the usage text alone. */
export class UsageError extends Error {}

/** A refusal class: an Error with a stable `code` (WireFailure, KnowledgeError, ...). */
export type RefusalClass = abstract new (...args: never[]) => Error & { code: string };

/** True for an error that node:util parseArgs throws for a wrong command line. */
function isParseArgsError(error: unknown): error is Error {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return error instanceof Error && typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_");
}

function printLine(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/**
 * Runs a script body. Prints its result as one JSON line when it returns a value (undefined prints nothing).
 * A refusal (WireFailure always, plus `refusals`) prints {"error":{code,message}} with exit status 1.
 * A UsageError or a node:util parseArgs error (code ERR_PARSE_ARGS_*) prints {"error":{"code":"invalid-input",
 * "message": message === "" ? usage : message + "\n\n" + usage}} with exit status 2. Anything else is rethrown.
 * The body may set process.exitCode itself for an extra exit status; a value it returns is printed as usual.
 */
export async function runScript(body: () => unknown, options: { usage: string; refusals?: readonly RefusalClass[] }): Promise<void> {
  // The trace of the script, when C64RT_TRACE is set; its start event carries the script and its arguments.
  startTrace("script", { warn: (line) => process.stderr.write(`${line}\n`) });
  const started = performance.now();
  const end = (fields: TraceFields) => trace().event("script.end", { ms: elapsedMs(started), status: process.exitCode ?? 0, ...fields });
  let result: unknown;
  try {
    result = await body();
  } catch (error) {
    if ([WireFailure, ...(options.refusals ?? [])].some((refusal) => error instanceof refusal)) {
      const { code, message } = error as Error & { code: string };
      printLine({ error: { code, message } });
      process.exitCode = 1;
      end({ error: { code, message } });
      return;
    }
    if (error instanceof UsageError || isParseArgsError(error)) {
      const { message } = error;
      printLine({ error: { code: "invalid-input", message: message === "" ? options.usage : `${message}\n\n${options.usage}` } });
      process.exitCode = 2;
      end({ error: { code: "invalid-input", message } });
      return;
    }
    end({ status: 1, error });
    throw error;
  }
  if (result !== undefined) printLine(result);
  end({ result });
}
