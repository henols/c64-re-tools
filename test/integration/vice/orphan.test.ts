// The orphan guard with real VICE: when the Host Runtime is
// killed with SIGKILL, its watchdog stops the VICE it started and removes
// that VICE's scratch directory. Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";

import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { isAlive } from "../../../src/native/processes.ts";
import { waitFor } from "../../kit.ts";
import { liveSkip, startHost, stopHosts, viceChildren, viceScratchOf } from "./live.ts";

// A failed assertion must not leave the runtime running: it would keep this test file alive.
after(stopHosts);

test("a Host Runtime killed with SIGKILL leaves no VICE and no scratch directory", { skip: liveSkip, timeout: 60_000 }, async () => {
  const host = await startHost();
  const exited = new Promise((resolve) => host.process.once("exit", resolve));
  const session = await ViceSessionClient.open({ videoStandard: "pal", env: { ...process.env, C64RT_HOST: host.address } });
  const [vice] = viceChildren(host.process.pid!);
  assert.ok(vice !== undefined, "the runtime started VICE");
  const scratch = viceScratchOf(vice);
  assert.ok(scratch !== undefined && /c64-re-tools-vice-/.test(scratch) && existsSync(scratch), `the VICE scratch directory, not ${scratch}`);

  host.process.kill("SIGKILL");
  await exited;
  // isAlive counts a zombie as ended: a container whose PID 1 never reaps keeps the killed VICE as one.
  await waitFor(() => !isAlive(vice), "the watchdog stopped VICE", 10_000);
  await waitFor(() => !existsSync(scratch), "the watchdog removed the scratch directory", 5_000);
  await session.close().catch(() => {});
});
