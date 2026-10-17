// The one error envelope for the skill scripts and the CLI: a script prints one JSON line,
// a refusal prints {"error":{code,message}} with exit status 1, and a usage error prints the
// usage text as an invalid-input error with exit status 2. Every script takes --project <folder>.

import { ProjectError, useProject } from "./project.ts";
import { shownMessage, WireFailure } from "./protocol/messages.ts";
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

/** The line that every usage text ends with. */
export const PROJECT_USAGE = "Every script takes --project <folder>: the project folder, relative to the working directory. Without it, the script uses the nearest folder at or above the working directory that holds .c64-re-tools/.";

/**
 * Takes --project <folder> and --project=<folder> out of a command line, up to "--".
 * Returns the folder and the other arguments. Throws UsageError for a --project without a folder or a second --project.
 */
export function takeProject(argv: readonly string[]): { project?: string; argv: string[] } {
  const rest: string[] = [];
  let project: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (argument === "--") {
      rest.push(...argv.slice(index));
      break;
    }
    let value: string | undefined;
    if (argument === "--project") {
      value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) throw new UsageError("--project needs a folder");
      index++;
    } else if (argument.startsWith("--project=")) {
      value = argument.slice("--project=".length);
      if (value === "") throw new UsageError("--project needs a folder");
    } else {
      rest.push(argument);
      continue;
    }
    if (project !== undefined) throw new UsageError("give --project only once");
    project = value;
  }
  return project === undefined ? { argv: rest } : { project, argv: rest };
}

function printLine(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/**
 * Runs a script body with the command line of the process, without --project: that sets the project first.
 * Prints its result as one JSON line when it returns a value (undefined prints nothing).
 * A refusal (WireFailure and ProjectError always, plus `refusals`) prints {"error":{code,message}} with exit status 1.
 * A UsageError or a node:util parseArgs error (code ERR_PARSE_ARGS_*) prints {"error":{"code":"invalid-input",
 * "message": message === "" ? usage : message + "\n\n" + usage}} with exit status 2. Anything else is rethrown.
 * The body may set process.exitCode itself for an extra exit status; a value it returns is printed as usual.
 */
export async function runScript(body: (argv: string[]) => unknown, options: { usage: string; refusals?: readonly RefusalClass[] }): Promise<void> {
  const usage = `${options.usage}\n\n${PROJECT_USAGE}`;
  // The trace of the script, when C64RT_TRACE is set; its start event carries the script and its arguments.
  startTrace("script", { warn: (line) => process.stderr.write(`${line}\n`) });
  const started = performance.now();
  const end = (fields: TraceFields) => trace().event("script.end", { ms: elapsedMs(started), status: process.exitCode ?? 0, ...fields });
  let result: unknown;
  try {
    const { project, argv } = takeProject(process.argv.slice(2));
    if (project !== undefined) useProject(project);
    result = await body(argv);
  } catch (error) {
    if ([WireFailure, ProjectError, ...(options.refusals ?? [])].some((refusal) => error instanceof refusal)) {
      const { code } = error as Error & { code: string };
      const message = shownMessage(error as Error & { code: string });
      printLine({ error: { code, message } });
      process.exitCode = 1;
      end({ error: { code, message } });
      return;
    }
    if (error instanceof UsageError || isParseArgsError(error)) {
      const { message } = error;
      printLine({ error: { code: "invalid-input", message: message === "" ? usage : `${message}\n\n${usage}` } });
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
