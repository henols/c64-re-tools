// A stand-in skill script for the watchdog test: it runs one tool through
// localToolContext and owns one workspace. It prints the tool's process
// group, the watchdog's process id and the workspace path as JSON and waits.

import { localToolContext } from "./local.ts";
import { Workspace } from "./staging.ts";

const { supervisor } = localToolContext();
const tool = supervisor.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"]);
const workspace = Workspace.create(supervisor, "c64-re-tools-local-test-");
process.stdout.write(`${JSON.stringify({ group: tool.pid, watchdog: supervisor.watchdogPid, path: workspace.root })}\n`);
setInterval(() => {}, 1_000);
