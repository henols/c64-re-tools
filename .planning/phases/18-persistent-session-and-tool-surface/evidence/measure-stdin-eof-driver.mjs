#!/usr/bin/env node
// measure-stdin-eof-driver.mjs -- plan 18-04 task 3(b) (D18-23). Orchestrates
// the whole measurement: synthesizes a scratch `.regen2000proj`, spawns
// measure-stdin-eof-parent.mjs (which itself spawns a REAL the external analyser
// child over the same `stdio: ["pipe","pipe","pipe"]` shape
// `anno-mcp-client.ts` uses), waits for that parent to report the real
// child's pid, SIGKILLs the PARENT (never the child directly -- the whole
// point is to observe what the CHILD does on its own once its stdin's write
// end closes), then polls whether the child is still alive, up to
// POLL_BOUND_MS, printing one JSON result line.
//
// Usage: node measure-stdin-eof-driver.mjs
// Requires `the external analyser` on PATH (or ANNO_BIN pointing at it).
import { spawn, execSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const POLL_BOUND_MS = 15_000;
const POLL_INTERVAL_MS = 200;

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const annoProjectPath = join(HERE, "..", "..", "..", "..", "src", "mcp", "vice", "anno-project.ts");
  const { synthesizeProject } = await import(pathToFileURL(annoProjectPath).href);

  const dir = mkdtempSync(join(tmpdir(), "d18-23-stdin-eof-"));
  const projectPath = join(dir, "measure.regen2000proj");
  writeFileSync(projectPath, synthesizeProject(new Uint8Array([0]), { origin: 0xc000 }));
  const pidFile = join(dir, "anno.pid");

  const bin = process.env.ANNO_BIN || "the external analyser";
  const versionOutput = execSync(`${bin} --version`).toString().trim();

  const parentScript = join(HERE, "measure-stdin-eof-parent.mjs");
  const parent = spawn(process.execPath, [parentScript, projectPath, pidFile, bin], {
    stdio: "ignore",
    detached: true,
  });
  parent.unref();

  // Wait for the parent to report the real child's pid.
  const spawnDeadline = Date.now() + 5000;
  while (!existsSync(pidFile) && Date.now() < spawnDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!existsSync(pidFile)) {
    console.log(JSON.stringify({ ok: false, reason: "parent never reported a pid within 5s" }, null, 2));
    process.exitCode = 1;
    return;
  }
  const pidFileContents = readFileSync(pidFile, "utf8").trim();
  if (pidFileContents.startsWith("SPAWN_ERROR")) {
    console.log(JSON.stringify({ ok: false, reason: pidFileContents }, null, 2));
    process.exitCode = 1;
    return;
  }
  const childPid = Number(pidFileContents);

  // Give the child a brief moment to finish its own startup before pulling
  // the rug -- this measures EOF behaviour, not a spawn race.
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!isAlive(childPid)) {
    console.log(
      JSON.stringify(
        { ok: false, reason: `the external analyser (pid ${childPid}) was already dead before the parent was killed` },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const parentPid = parent.pid;
  const killedAtEpoch = Date.now();
  process.kill(parentPid, "SIGKILL");

  let exitedAtEpoch = null;
  let stillAlive = true;
  while (Date.now() - killedAtEpoch < POLL_BOUND_MS) {
    if (!isAlive(childPid)) {
      exitedAtEpoch = Date.now();
      stillAlive = false;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const result = {
    ok: true,
    bin,
    version: versionOutput,
    parentPid,
    childPid,
    pollBoundMs: POLL_BOUND_MS,
    childSelfTerminatedOnParentDeath: !stillAlive,
    elapsedMsUntilChildExit: exitedAtEpoch !== null ? exitedAtEpoch - killedAtEpoch : null,
    date: new Date().toISOString(),
  };

  // If the child is STILL alive after the poll bound, the measurement's own
  // point requires observing that (not silently reaping it before the bound
  // is reached) -- but this driver must not leak a real process out of a
  // measurement run, so kill it explicitly now that the observation window
  // has closed.
  if (stillAlive && isAlive(childPid)) {
    try {
      process.kill(childPid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  rmSync(dir, { recursive: true, force: true });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, reason: `driver threw: ${err && err.message ? err.message : String(err)}` }));
  process.exitCode = 1;
});
