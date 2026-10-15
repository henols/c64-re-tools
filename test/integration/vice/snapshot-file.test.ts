// A snapshot saved as bytes in one session restores in a new one, and a file
// that is not a snapshot is refused by name (D41). Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { WireFailure } from "../../../src/protocol/messages.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let server: HostServer | undefined;
after(async () => {
  await server?.close();
});

test("a snapshot file from one session restores the machine in a new session", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  const env = { C64RT_HOST: `${server.host}:${server.port}` };

  const first = await ViceSessionClient.open({ videoStandard: "pal", env });
  let file: Buffer;
  try {
    await first.execution({ action: "advance-frames", count: 50, space: "c64" });
    await first.memoryWrite({ address: 0xc000, data: "c0ffee", space: "c64", view: "ram" });
    await first.snapshot({ action: "save", name: "marked" });
    file = await first.snapshotExport("marked");
  } finally {
    await first.close();
  }
  assert.ok(file.length > 1000, `a snapshot file has ${file.length} bytes`);

  const second = await ViceSessionClient.open({ videoStandard: "pal", env });
  try {
    assert.equal((await second.memoryRead({ address: 0xc000, size: 3, space: "c64", view: "ram" })).data === "c0ffee", false, "a new machine does not have the mark");
    assert.deepEqual(await second.snapshotRestore(file), { restored: true, state: "stopped" });
    assert.equal((await second.memoryRead({ address: 0xc000, size: 3, space: "c64", view: "ram" })).data, "c0ffee");
    await assert.rejects(
      second.snapshotRestore(Buffer.from("this is not a snapshot")),
      (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && /not a VICE snapshot file/.test(error.message),
    );
    // A snapshot file that VICE does not read: the right header, then bytes of no snapshot.
    await assert.rejects(
      second.snapshotRestore(Buffer.concat([file.subarray(0, 19), Buffer.alloc(64, 0x55)])),
      (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && /restores only in the emulator version/.test(error.message),
    );
    assert.equal((await second.memoryRead({ address: 0xc000, size: 3, space: "c64", view: "ram" })).data, "c0ffee", "a refused file leaves the machine as it was");
  } finally {
    await second.close();
  }
});
