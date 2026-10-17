#!/usr/bin/env tsx

import { parseArgs } from "node:util";

import { DEFAULT_HOST_PORT } from "../protocol/messages.ts";
import { ProcessSupervisor } from "../native/processes.ts";
import { startTrace, trace } from "../trace.ts";
import { ListenError, parsePort, startHostServer, stopSignal } from "./server.ts";
import { viceFlaws, type ViceVersion } from "../native/discover.ts";
import { inspect } from "./tools/c1541.ts";
import { createToolDispatcher } from "./tools/index.ts";
import { checkViceStarts, findVice } from "./vice/process.ts";
import { viceSessionFactory } from "./vice/session.ts";
import { PACKAGE } from "../package.ts";

const HELP = `c64-re-tools-host

Usage:
  npx -y --package=${PACKAGE.name}@${PACKAGE.tag} c64-re-tools-host [--port <port>] [--log-console] [--log-dir <directory>]
  c64-re-tools-host --help

Runs the c64-re-tools Host Runtime in the foreground. It first starts VICE
once (x64sc on PATH, or C64RT_VICE) and does not start if VICE cannot run.
It listens on port ${DEFAULT_HOST_PORT} on every address, so a dev container
reaches it as host.docker.internal. It starts one VICE emulator for each
connected c64-re-tools-mcp process, and runs the tools that come with VICE
(c1541, petcat) for skill scripts. Stop it with Ctrl+C; that stops every
emulator and tool it started.

Options:
  --port <port>            Listen on this port instead (0 picks a free port).
  --log-console            Also print each request with its result, and each run
                           of c1541 or petcat, to the console.
  --log-dir <directory>    Write the same events as JSON lines to a file in this
                           directory, with a copy of each VICE log.
  --help                   Show this help.

The host always logs its start and stop, connections, failures, and each call
from a skill script (c1541, petcat) with its outcome. --log-console adds the
calls of the MCP server and the tool runs. C64RT_TRACE does not apply to the host.`;

function log(line: string): void {
  process.stderr.write(`c64-re-tools-host: ${line}\n`);
  trace().log(line);
}

async function main(): Promise<number> {
  let values: { help?: boolean; port?: string; "log-console"?: boolean; "log-dir"?: string };
  try {
    ({ values } = parseArgs({
      options: { help: { type: "boolean" }, port: { type: "string" }, "log-console": { type: "boolean" }, "log-dir": { type: "string" } },
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}\n`);
    return 2;
  }
  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }
  const logDir = values["log-dir"];
  if (logDir === "") {
    process.stderr.write("--log-dir needs a directory.\n");
    return 2;
  }
  startTrace("host", {
    target: {
      ...(logDir === undefined ? {} : { dir: { path: logDir, given: `--log-dir ${logDir}` } }),
      ...(values["log-console"] ? { echo: (line: string) => process.stderr.write(`c64-re-tools-host: ${line}\n`) } : {}),
    },
    warn: log,
  });

  const port = values.port === undefined ? DEFAULT_HOST_PORT : parsePort(values.port);
  if (port === undefined) {
    process.stderr.write(`--port must be a number from 0 to 65535, written with digits only. You gave "${values.port}".\n`);
    return 2;
  }

  // First, so that every start, also a refused one, tells which runtime runs.
  log(`${PACKAGE.name} ${PACKAGE.version} (Node.js ${process.version}, ${process.platform} ${process.arch})`);

  // Without an emulator the runtime is useless: refuse to start, by name and with the remedy.
  try {
    findVice(process.env);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }

  // Every emulator and tool is started through this one supervisor; however
  // this process ends, the exit guard takes their process groups down with it,
  // and the watchdog does the same if this process is killed.
  const supervisor = new ProcessSupervisor();
  supervisor.startWatchdog("host");

  // Finding x64sc is not enough: VICE without its ROM files exits at once.
  let vice: ViceVersion;
  try {
    vice = await checkViceStarts({ supervisor });
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    await supervisor.stopAll();
    return 1;
  }
  log(`VICE ${vice.major}.${vice.minor}${vice.revision === undefined ? "" : ` r${vice.revision}`} starts`);
  const flaws = viceFlaws(vice);
  // A known VICE flaw is named, not worked around.
  for (const flaw of flaws) log(`Known VICE flaw: ${flaw}`);

  let server;
  try {
    server = await startHostServer({
      host: "0.0.0.0",
      port,
      log,
      createViceSession: viceSessionFactory({
        supervisor,
        log,
        flaws,
        // c1541 lists the disk, so an autostart index selects a program.
        directory: async (imageType, image) => {
          const { result } = await inspect({ action: "directory", imageType }, image, { supervisor, signal: new AbortController().signal, log });
          return result.action === "directory" ? result.entries : [];
        },
      }),
      tools: createToolDispatcher({ supervisor, log, vice }),
    });
  } catch (error) {
    if (error instanceof ListenError && error.code === "EADDRINUSE") {
      process.stderr.write(`Port ${error.port} on ${error.address} is in use. Is another c64-re-tools-host running?\n`);
      return 1;
    }
    throw error;
  }
  const address = `${server.host}:${server.port}`;
  process.stdout.write(`c64-re-tools-host listening on ${address}\n`);
  trace().event("host.listening", { addresses: [address] });

  trace().event("host.stop", { signal: await stopSignal(log) });
  await server.close();
  await supervisor.stopAll();
  return 0;
}

process.exitCode = await main();
