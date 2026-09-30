// broker-children.test.ts -- the child registry stops whole process groups.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

import { createBrokerState } from "../../src/mcp/vice/broker-state.mts";
import { trackChild, stopAllChildren, killAllChildrenNow, isGroupAlive, signalGroup, type ChildEvent } from "../../src/mcp/vice/broker-children.mts";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return predicate();
}

/** Spawns `sh -c` in its own group; the script prints its background child's pid. */
async function spawnForking(script: string): Promise<{ leader: number; grandchild: number; child: ReturnType<typeof spawn> }> {
  const child = spawn("/bin/sh", ["-c", script], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
  const grandchild = await new Promise<number>((resolve, reject) => {
    child.stdout!.once("data", (chunk: Buffer) => resolve(Number(chunk.toString("utf8").trim())));
    child.once("error", reject);
  });
  return { leader: child.pid!, grandchild, child };
}

test("stopAllChildren: stops every tracked group, the leader's background child included, and reports the count", async () => {
  const state = createBrokerState();
  const events: ChildEvent[] = [];
  state.childListener = (e) => events.push(e);
  const a = await spawnForking('sleep 600 & echo $!; wait');
  const b = await spawnForking('sleep 600 & echo $!; wait');
  trackChild(state, a.child, "host-tool");
  trackChild(state, b.child, "emulator");
  assert.deepEqual([...state.children.keys()].sort(), [a.leader, b.leader].sort());
  assert.ok([a.leader, a.grandchild, b.leader, b.grandchild].every(isAlive));

  const stopped = await stopAllChildren(state, { killWaitMs: 2000 });
  assert.equal(stopped, 2);
  assert.ok(await waitFor(() => [a.grandchild, b.grandchild].every((p) => !isAlive(p))), "every grandchild must be gone");
  assert.ok(await waitFor(() => state.children.size === 0), "every exited child leaves the registry");
  assert.deepEqual(
    events.filter((e) => e.op === "track").map((e) => e.pid).sort(),
    [a.leader, b.leader].sort(),
    "the listener hears every track",
  );
  assert.ok(await waitFor(() => events.filter((e) => e.op === "untrack").length === 2), "and every untrack");
});

test("trackChild: when a tracked process exits on its own, its leftover descendants are killed with it", async () => {
  const state = createBrokerState();
  const t = await spawnForking('sleep 600 & echo $!; sleep 0.3; exit 0');
  trackChild(state, t.child, "host-tool");
  assert.ok(isAlive(t.grandchild));
  assert.ok(await waitFor(() => !isAlive(t.grandchild)), "the orphaned descendant must not outlive its leader");
  assert.equal(state.children.size, 0);
});

test("killAllChildrenNow: SIGKILLs every tracked group synchronously", async () => {
  const state = createBrokerState();
  const t = await spawnForking('trap "" TERM; sleep 600 & echo $!; wait');
  trackChild(state, t.child, "emulator");
  killAllChildrenNow(state);
  assert.ok(await waitFor(() => !isAlive(t.grandchild) && !isAlive(t.leader)));
});

test("signalGroup and isGroupAlive fall back to the pid for a process that leads no group, and never throw for a gone pid", async () => {
  // No shell in between: a shell that forked `sleep` would orphan it when only
  // the shell is killed, which is the very leak this module prevents.
  const child = spawn("sleep", ["600"], { stdio: "ignore" });
  const pid = child.pid!;
  assert.ok(isGroupAlive(pid));
  const exited = new Promise((r) => child.once("exit", r));
  signalGroup(pid, "SIGKILL");
  await exited;
  assert.equal(child.signalCode, "SIGKILL");
  assert.doesNotThrow(() => signalGroup(pid, "SIGKILL"));
  assert.equal(isGroupAlive(999999999), false);
});

test("trackChild: when a tracked process exits, only its group is signalled, never the bare pid", () => {
  const state = createBrokerState();
  const child = new EventEmitter() as unknown as ChildProcess;
  (child as unknown as { pid: number }).pid = 424242;
  const signalled: number[] = [];
  trackChild(state, child, "emulator", (pid) => {
    signalled.push(pid);
  });
  child.emit("exit");
  assert.deepEqual(signalled, [-424242]);
});
