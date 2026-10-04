#!/usr/bin/env node

import { parseArgs } from "node:util";

import { DEFAULT_HOST_PORT } from "../protocol.ts";
import { ProcessSupervisor } from "../native/processes.ts";
import { isLoopback, startHostServer } from "./server.ts";
import { createToolDispatcher } from "./tools/index.ts";
import { checkViceStarts, findVice } from "./vice/process.ts";
import { viceSessionFactory } from "./vice/session.ts";

const HELP = `c64-re-tools-host

Usage:
  c64-re-tools-host [--port <port>] [--listen <address> ...]
  c64-re-tools-host --help

Runs the c64-re-tools Host Runtime in the foreground. It first starts VICE
once (x64sc on PATH, or C64RT_VICE) and does not start if VICE cannot run.
It listens on 127.0.0.1:${DEFAULT_HOST_PORT}, starts one VICE emulator for each
connected c64-re-tools-mcp process, and runs the tools that come with VICE
(c1541, petcat) for skill scripts. Stop it with Ctrl+C; that stops every
emulator and tool it started.

Options:
  --port <port>       Listen on this port instead (0 picks a free port).
  --listen <address>  Also listen on this address, on the same port, for
                      example the container bridge (172.17.0.1). An address
                      that is not loopback needs C64RT_HOST_TOKEN: set it to
                      the same secret for this program and for the clients.
  --help              Show this help.`;

function log(line: string): void {
  process.stderr.write(`${new Date().toISOString()} ${line}\n`);
}

async function main(): Promise<number> {
  let values: { help?: boolean; port?: string; listen?: string[] };
  try {
    ({ values } = parseArgs({ options: { help: { type: "boolean" }, port: { type: "string" }, listen: { type: "string", multiple: true } }, strict: true }));
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

  const extraHosts = values.listen ?? [];
  const token = process.env.C64RT_HOST_TOKEN;
  if (extraHosts.some((address) => !isLoopback(address)) && (token === undefined || token.length < 16)) {
    process.stderr.write("--listen with an address that is not loopback needs C64RT_HOST_TOKEN with at least 16 characters, so that only your clients can connect.\n");
    return 2;
  }

  // Without an emulator the runtime is useless: refuse to start, by name and with the remedy.
  try {
    findVice(process.env);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }

  // Every emulator and tool is started through this one supervisor; however
  // this process ends, the exit guard takes their process groups down with it,
  // and the watchdog does the same if this process is killed (D7).
  const supervisor = new ProcessSupervisor();
  supervisor.startWatchdog();

  // Finding x64sc is not enough: VICE without its ROM files exits at once.
  try {
    await checkViceStarts({ supervisor });
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    await supervisor.stopAll();
    return 1;
  }
  log("VICE starts");

  let server;
  try {
    server = await startHostServer({
      port,
      extraHosts,
      ...(token === undefined || token === "" ? {} : { token }),
      log,
      createViceSession: viceSessionFactory({ supervisor, log }),
      tools: createToolDispatcher({ supervisor, log }),
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      process.stderr.write(`Port ${port} on 127.0.0.1 is in use. Is another c64-re-tools-host running?\n`);
      return 1;
    }
    if ((error as NodeJS.ErrnoException).code === "EADDRNOTAVAIL") {
      process.stderr.write(`An address in --listen does not belong to this machine: ${extraHosts.join(", ")}\n`);
      return 1;
    }
    throw error;
  }
  process.stdout.write(`c64-re-tools-host listening on ${[server.host, ...extraHosts].map((address) => `${address}:${server.port}`).join(", ")}\n`);

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
