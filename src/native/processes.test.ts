import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { ProcessSupervisor, type SupervisedProcess } from "./processes.ts";

const posix = process.platform !== "win32";

// A stub that forks a long-lived grandchild, prints its pid, then keeps running.
const FORKING_STUB = `
const { spawn } = require("node:child_process");
const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
console.log(grandchild.pid);
setInterval(() => {}, 1000);
`;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

async function eventuallyDead(pid: number, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (isAlive(pid)) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return true;
}

async function firstLine(child: SupervisedProcess): Promise<string> {
  const [line] = (await once(createInterface({ input: child.child.stdout! }), "line")) as [string];
  return line;
}

test("stop terminates the child and every descendant in its group", { skip: !posix }, async () => {
  const supervisor = new ProcessSupervisor();
  const child = supervisor.spawn([process.execPath, "-e", FORKING_STUB], { stdio: ["ignore", "pipe", "ignore"] });
  const grandchild = Number(await firstLine(child));
  assert.ok(isAlive(child.pid) && isAlive(grandchild));

  await child.stop();
  assert.ok(await eventuallyDead(child.pid), "child survived");
  assert.ok(await eventuallyDead(grandchild), "grandchild survived");
  assert.equal(supervisor.size, 0);
});

test("stop reaches descendants after the leader has already exited", { skip: !posix }, async () => {
  const supervisor = new ProcessSupervisor();
  const stub = `
    const { spawn } = require("node:child_process");
    const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    console.log(g.pid);
    process.exit(0);
  `;
  const child = supervisor.spawn([process.execPath, "-e", stub], { stdio: ["ignore", "pipe", "ignore"] });
  const grandchild = Number(await firstLine(child));
  await child.exited;
  assert.ok(isAlive(grandchild), "the orphaned grandchild must still be running before stop");

  await child.stop();
  assert.ok(await eventuallyDead(grandchild), "grandchild survived");
});

test("a child that ignores SIGTERM is killed after the grace period", { skip: !posix }, async () => {
  const supervisor = new ProcessSupervisor({ graceMs: 200 });
  const stub = `process.on("SIGTERM", () => {}); console.log("ready"); setInterval(() => {}, 1000);`;
  const child = supervisor.spawn([process.execPath, "-e", stub], { stdio: ["ignore", "pipe", "ignore"] });
  await firstLine(child);

  const started = Date.now();
  await child.stop();
  assert.ok(Date.now() - started >= 200, "SIGKILL came before the grace period ended");
  assert.equal((await child.exited).signal, "SIGKILL");
});

test("stop is idempotent and stopAll stops every group", { skip: !posix }, async () => {
  const supervisor = new ProcessSupervisor();
  const children = [1, 2, 3].map(() =>
    supervisor.spawn([process.execPath, "-e", FORKING_STUB], { stdio: ["ignore", "pipe", "ignore"] }),
  );
  const grandchildren = await Promise.all(children.map(async (child) => Number(await firstLine(child))));
  assert.equal(supervisor.size, 3);

  await Promise.all([supervisor.stopAll(), children[0]!.stop(), children[0]!.stop()]);
  for (const pid of [...children.map((child) => child.pid), ...grandchildren]) {
    assert.ok(await eventuallyDead(pid), `pid ${pid} survived`);
  }
  assert.equal(supervisor.size, 0);
});

test("a command that does not exist reports an exit without throwing", async () => {
  const supervisor = new ProcessSupervisor();
  const child = supervisor.spawn(["/nonexistent/c64-re-tools-test-binary"]);
  assert.deepEqual(await child.exited, { code: null, signal: null });
  await child.stop();
  assert.equal(supervisor.size, 0);
});

test("the exit guard kills every group when the owning process exits", { skip: !posix }, async () => {
  // The owner runs the real supervisor, starts a forking stub, prints both pids and exits at once.
  const moduleUrl = pathToFileURL(new URL("./processes.ts", import.meta.url).pathname).href;
  const owner = `
    import { once } from "node:events";
    import { createInterface } from "node:readline";
    import { ProcessSupervisor } from ${JSON.stringify(moduleUrl)};
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    const child = supervisor.spawn([process.execPath, "-e", ${JSON.stringify(FORKING_STUB)}], { stdio: ["ignore", "pipe", "ignore"] });
    const [line] = await once(createInterface({ input: child.child.stdout }), "line");
    console.log(child.pid + " " + line);
    process.exit(0);
  `;
  const run = spawn(process.execPath, ["--input-type=module", "-e", owner], { stdio: ["ignore", "pipe", "inherit"] });
  const [line] = (await once(createInterface({ input: run.stdout }), "line")) as [string];
  await once(run, "exit");
  for (const pid of line.split(" ").map(Number)) {
    assert.ok(await eventuallyDead(pid), `pid ${pid} survived its owner's exit`);
  }
});
