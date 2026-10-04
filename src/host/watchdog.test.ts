import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";

const skip = process.platform === "win32" ? "process groups are POSIX" : false;
const program = join(import.meta.dirname, "watchdog.testkit.ts");

function groupAlive(group: number): boolean {
  try {
    process.kill(-group, 0);
    return true;
  } catch {
    return false;
  }
}

async function startRuntime(): Promise<{ pid: number; group: number; path: string }> {
  const runtime = spawn(process.execPath, [program], { stdio: ["ignore", "pipe", "inherit"] });
  const [line] = (await once(createInterface({ input: runtime.stdout! }), "line")) as [string];
  return { pid: runtime.pid!, ...(JSON.parse(line) as { group: number; path: string }) };
}

async function until(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

test("a runtime killed with SIGKILL leaves no process group and no owned path", { skip, timeout: 20_000 }, async () => {
  const runtime = await startRuntime();
  assert.ok(groupAlive(runtime.group));
  assert.ok(existsSync(runtime.path));
  process.kill(runtime.pid, "SIGKILL");
  assert.ok(await until(() => !groupAlive(runtime.group), 8_000), "the watchdog stopped the child group");
  assert.ok(await until(() => !existsSync(runtime.path), 4_000), "the watchdog removed the owned path");
});

test("a runtime that exits normally cleans up by itself", { skip, timeout: 20_000 }, async () => {
  const runtime = await startRuntime();
  process.kill(runtime.pid, "SIGTERM");
  assert.ok(await until(() => !groupAlive(runtime.group), 3_000), "the exit guard stopped the child group");
  assert.equal(existsSync(runtime.path), false, "the exit guard removed the owned path");
});
