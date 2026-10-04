// The c64-disk script: inspects a project disk image with c1541 through the
// Host Runtime and extracts files into the project.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { inspectDisk, WireFailure } from "#src/host-client/tools.ts";
import { resolveProjectPath } from "#src/project.ts";

const USAGE = `disk.ts <action> <image> [name] [--out <file>]

  directory <image>                 disk name, id, free blocks and the files
  bam <image>                       free and used sectors of each track
  entry <image> <name>              the directory entry of one file
  chain <image> <name>              the track and sector of each block of one file
  read <image> <name> --out <file>  write the bytes of one file into the project

<image> is a .d64, .d71, .d81 or .g64 file, relative to the project directory.
<name> is the file name as the directory shows it. Write a byte that has no
character as {$xx}, for example {$c1}. The result is one JSON object.`;

const ACTIONS = ["directory", "bam", "entry", "chain", "read"] as const;
type Action = (typeof ACTIONS)[number];

class UsageError extends Error {}

async function run(argv: string[]): Promise<{ output: unknown; failed: boolean }> {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { out: { type: "string" }, help: { type: "boolean" } } });
  if (values.help) throw new UsageError("");
  const [action, image, name, ...extra] = positionals;
  if (!ACTIONS.includes(action as Action)) throw new UsageError(`the action must be one of ${ACTIONS.join(", ")}`);
  if (image === undefined) throw new UsageError("the disk image is necessary");
  const named = action === "entry" || action === "chain" || action === "read";
  if (named && name === undefined) throw new UsageError(`${action} needs a file name`);
  if ((!named && name !== undefined) || extra.length > 0) throw new UsageError("too many arguments");
  if (action === "read" && values.out === undefined) throw new UsageError("read needs --out <file>");
  if (action !== "read" && values.out !== undefined) throw new UsageError("only read takes --out");
  let outPath: string | undefined;
  if (values.out !== undefined) {
    try {
      outPath = resolveProjectPath(values.out);
    } catch {
      throw new UsageError(`--out must be a path relative to the project directory that stays inside it, not ${values.out}`);
    }
  }

  const result = await inspectDisk({ image, action: action as Action, ...(name === undefined ? {} : { name }) });
  if ("found" in result && !result.found) return { output: { found: false }, failed: true };
  if (result.action === "read" && result.found) {
    mkdirSync(dirname(outPath!), { recursive: true });
    writeFileSync(outPath!, result.data!);
    return { output: { found: true, name: result.name, bytes: result.bytes, output: values.out }, failed: false };
  }
  const { action: _action, ...output } = result;
  return { output, failed: false };
}

try {
  const { output, failed } = await run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(output)}\n`);
  if (failed) process.exitCode = 1;
} catch (error) {
  if (error instanceof WireFailure) {
    process.stdout.write(`${JSON.stringify({ error: { code: error.code, message: error.message } })}\n`);
    process.exitCode = 1;
  } else if (error instanceof UsageError || (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    const message = (error as Error).message;
    process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: message === "" ? USAGE : `${message}\n\n${USAGE}` } })}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
