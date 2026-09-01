#!/usr/bin/env node
// measure-stdin-eof-parent.mjs -- plan 18-04 task 3(b) (D18-23). The
// SHORT-LIVED "parent" half of the stdin-EOF measurement: spawns a real
// `analyser --mcp-server-stdio <project>` child exactly the way
// `anno-mcp-client.ts`'s openAnnoSession() does (`stdio: ["pipe", "pipe",
// "pipe"]`), writes the child's pid to a file once spawn is confirmed, then
// idles forever -- doing NOTHING else. This process is SIGKILLed from the
// OUTSIDE by measure-stdin-eof-driver.sh once the pid file appears, so no
// exit hook of any kind (not this project's own onTeardown(), not even
// Node's own "exit"/"beforeExit" events) ever runs before the external analyser
// child's stdin sees EOF -- exactly the SIGKILLed-proxy shape D18-23 asks
// about, reproduced directly rather than assumed.
//
// Usage: node measure-stdin-eof-parent.mjs <projectPath> <pidFile> [bin]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [, , projectPath, pidFile, binArg] = process.argv;
if (!projectPath || !pidFile) {
  console.error("usage: measure-stdin-eof-parent.mjs <projectPath> <pidFile> [bin]");
  process.exit(2);
}
const bin = binArg || process.env.ANNO_BIN || "the external analyser";

const child = spawn(bin, ["--mcp-server-stdio", projectPath], { stdio: ["pipe", "pipe", "pipe"] });

child.once("spawn", () => {
  writeFileSync(pidFile, String(child.pid));
});
child.once("error", (err) => {
  writeFileSync(pidFile, `SPAWN_ERROR: ${err && err.message ? err.message : String(err)}`);
});

// Deliberately no signal handlers, no stdin/stdout wiring beyond the spawn
// itself, and no exit path of its own -- this process is meant to be
// SIGKILLed while it is doing nothing, which is the entire point of the
// measurement. Keep the event loop alive indefinitely until that happens.
setInterval(() => {}, 0x7fffffff);
