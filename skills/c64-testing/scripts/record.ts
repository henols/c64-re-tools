// The c64-testing record script: plays the steps of a record file on the
// original program in the replay core (c64run), and writes the session as a
// recording folder: recording.json, reads.txt, checkpoints.txt, coverage.bin.
// Exit status: 0 recorded, 1 the session did not complete, 2 a bad call.

import { parseArgs } from "node:util";

import { COVERAGE } from "#src/c64.ts";
import { writeProjectFile } from "#src/host-client/transfer.ts";
import { C64RunSession, PAL_FRAME_CYCLES } from "#src/native/c64run.ts";
import { localToolContext } from "#src/native/local.ts";
import { Workspace } from "#src/native/staging.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { play } from "./lib/play.ts";
import { record, readRecordFile, RECORDING_FILES } from "./lib/recording.ts";
import { ScenarioError } from "./lib/scenario.ts";

const USAGE = `record.ts <record.json> --out <folder> [--play [--joystick 1|2] [--http-port <n>]]

<record.json> is a record file relative to the project folder. See
references/recording-format.md. --out is the recording folder, for example
tests/recordings/<name>. With --play, a person plays after the steps: the
script prints the address of a page on stderr and runs until Stop on the page.
--joystick is the port of the arrow keys, space and the gamepad (default 2).
--http-port is the port of the page (default 6465). The result is one JSON object.`;

/** The default port of the --play page: next to the Host Runtime's 6464. */
const DEFAULT_HTTP_PORT = 6465;

async function run(argv: string[]): Promise<Record<string, unknown>> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: { out: { type: "string" }, play: { type: "boolean" }, joystick: { type: "string" }, "http-port": { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one record file");
  if (values.out === undefined) throw new UsageError("give --out, the recording folder");
  try {
    resolveProjectPath(values.out);
  } catch {
    throw new UsageError(`--out must be a path relative to the project folder that stays inside it, not ${values.out}`);
  }
  if (!values.play && (values.joystick !== undefined || values["http-port"] !== undefined)) throw new UsageError("--joystick and --http-port are for --play");
  const joystick = values.joystick === undefined ? 2 : Number(values.joystick);
  if (joystick !== 1 && joystick !== 2) throw new UsageError("--joystick must be 1 or 2");
  const httpPort = values["http-port"] === undefined ? DEFAULT_HTTP_PORT : Number(values["http-port"]);
  if (!Number.isInteger(httpPort) || httpPort < 0 || httpPort > 65535) throw new UsageError("--http-port must be a TCP port from 0 to 65535");
  let file;
  try {
    file = readRecordFile(positionals[0]!);
  } catch (error) {
    if (error instanceof ScenarioError) throw new UsageError(error.message);
    throw error;
  }
  const context = localToolContext();
  const core = await C64RunSession.open(context);
  const workspace = Workspace.create(context.supervisor, "c64-re-tools-record-");
  try {
    let outcome;
    try {
      const person = values.play
        ? (session: C64RunSession) =>
            play(session, { httpPort, joystick, ready: (url) => process.stderr.write(`Play at ${url} and press Stop on the page to save the recording.\n`) })
        : undefined;
      outcome = await record(core, file, workspace, person);
    } catch (error) {
      if (error instanceof ScenarioError) throw new UsageError(error.message);
      throw error;
    }
    const summary = {
      name: file.name,
      frames: Math.round(outcome.recording.ticks / PAL_FRAME_CYCLES),
      inputSites: outcome.recording.sites.length,
      events: outcome.recording.events.length,
      // The instructions in the coverage map: 0 when the program never read its input from RAM.
      executed: outcome.coverage.reduce((count, byte) => count + ((byte & COVERAGE.ramExecute) === 0 ? 0 : 1), 0),
    };
    if (outcome.reason !== undefined) {
      process.exitCode = 1;
      return { recorded: false, reason: outcome.reason, ...summary };
    }
    const write = (name: string, bytes: Uint8Array) => writeProjectFile(`${values.out}/${name}`, bytes, { what: "--out" });
    write(RECORDING_FILES.recording, Buffer.from(`${JSON.stringify(outcome.recording, null, 2)}\n`));
    write(RECORDING_FILES.reads, outcome.reads);
    write(RECORDING_FILES.coverage, outcome.coverage);
    return { recorded: true, out: values.out, ...summary, files: Object.values(RECORDING_FILES) };
  } finally {
    await core.close();
    workspace.remove();
  }
}

await runScript(run, { usage: USAGE });
