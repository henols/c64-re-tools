// The orphan guard (D7) with real VICE: when the built Host Runtime is
// killed with SIGKILL, its watchdog stops the VICE it started and removes
// that VICE's scratch directory. Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";

import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { liveEnv, liveSkip, viceChildren } from "./live.ts";

const root = resolve(import.meta.dirname, "../../..");

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function until(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return true;
}

test("a Host Runtime killed with SIGKILL leaves no VICE and no scratch directory", { skip: liveSkip, timeout: 60_000 }, async () => {
  const host = spawn(process.execPath, [resolve(root, "src/host/main.ts"), "--port", "0"], { env: liveEnv(), stdio: ["ignore", "pipe", "inherit"] });
  const [line] = (await once(createInterface({ input: host.stdout! }), "line")) as [string];
  const env = { ...process.env, C64RT_HOST: `127.0.0.1:${/:(\d+)$/.exec(line)![1]}` };
  const session = await ViceSessionClient.open({ videoStandard: "pal", env });
  const [vice] = viceChildren(host.pid!);
  assert.ok(vice !== undefined, "the runtime started VICE");
  const scratch = readlinkSync(`/proc/${vice}/cwd`);
  assert.match(scratch, /c64-re-tools-vice-/);

  const exited = once(host, "exit");
  host.kill("SIGKILL");
  await exited;
  assert.ok(await until(() => !alive(vice), 10_000), "the watchdog stopped VICE");
  assert.ok(await until(() => !existsSync(scratch), 5_000), "the watchdog removed the scratch directory");
  await session.close().catch(() => {});
});
