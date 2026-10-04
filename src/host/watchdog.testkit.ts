// A stand-in Host Runtime for the watchdog test: a supervisor with a
// watchdog, one child process group and one owned path. It prints them as
// JSON and waits; SIGTERM makes it exit normally.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ProcessSupervisor } from "./processes.ts";

const supervisor = new ProcessSupervisor({ graceMs: 500 });
supervisor.startWatchdog();
const child = supervisor.spawn(["sleep", "600"]);
const path = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-test-"));
supervisor.ownPath(path);
process.stdout.write(`${JSON.stringify({ group: child.pid, path })}\n`);
process.once("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1_000);
