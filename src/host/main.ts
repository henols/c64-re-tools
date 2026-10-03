#!/usr/bin/env node

import { parseArgs } from "node:util";

import { DEFAULT_HOST_PORT, WireFailure } from "../protocol.ts";
import { ProcessSupervisor } from "./processes.ts";
import { startHostServer } from "./server.ts";

const HELP = `c64-re-tools-host

Usage:
  c64-re-tools-host [--port <port>]
  c64-re-tools-host --help

Runs the c64-re-tools Host Runtime in the foreground. It listens on
127.0.0.1:${DEFAULT_HOST_PORT} and starts one VICE emulator for each connected
c64-re-tools-mcp process. Stop it with Ctrl+C; that stops every emulator it
started.

Options:
  --port <port>  Listen on this port instead (0 picks a free port).
  --help         Show this help.`;

function log(line: string): void {
  process.stderr.write(`${new Date().toISOString()} ${line}\n`);
}

async function main(): Promise<number> {
  let values: { help?: boolean; port?: string };
  try {
    ({ values } = parseArgs({ options: { help: { type: "boolean" }, port: { type: "string" } }, strict: true }));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}\n`);
    return 2;
  }
  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }

  const port = values.port === undefined ? DEFAULT_HOST_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 0xffff) {
    process.stderr.write(`--port must be an integer from 0 to 65535, got ${values.port}\n`);
    return 2;
  }

  // Every emulator and tool is started through this one supervisor; however
  // this process ends, the exit guard takes their process groups down with it.
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();

  let server;
  try {
    server = await startHostServer({
      port,
      log,
      createViceSession: async () => {
        throw new WireFailure("machine-unavailable", "This host runtime cannot start emulators yet.");
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      process.stderr.write(`Port ${port} on 127.0.0.1 is in use. Is another c64-re-tools-host running?\n`);
      return 1;
    }
    throw error;
  }
  process.stdout.write(`c64-re-tools-host listening on ${server.host}:${server.port}\n`);

  await new Promise<void>((resolve) => {
    const stop = (signal: NodeJS.Signals) => {
      log(`received ${signal}, stopping`);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  await server.close();
  await supervisor.stopAll();
  return 0;
}

process.exitCode = await main();
