import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { connect } from "node:net";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { encodeFrame, HOST_PROTOCOL_ID } from "../../src/protocol.ts";
import { FrameDecoder } from "../../src/protocol.testkit.ts";
import { liveSkip, startHost, stopHosts } from "../integration/vice/live.ts";

// Runs the executable from src/, as Node runs it after an install.
const root = resolve(import.meta.dirname, "../..");

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-host-e2e-"));
after(async () => {
  try {
    await stopHosts();
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
const shellStandIn = process.platform === "win32" ? "the stand-in VICE is a shell script" : false;

test("c64-re-tools-host runs in the foreground, serves the protocol and stops on SIGTERM", { skip: liveSkip }, async () => {
  // The runtime starts VICE once before it listens, so this needs the real one.
  const host = await startHost();
  const match = /listening on (127\.0\.0\.1):(\d+)$/.exec(host.line);
  assert.ok(match, host.line);

  // A client from another installation is refused without starting an emulator.
  const socket = connect({ host: match[1]!, port: Number(match[2]) });
  await once(socket, "connect");
  socket.write(encodeFrame({ type: "hello", protocol: HOST_PROTOCOL_ID, version: 0, role: "vice-session" }));
  const decoder = new FrameDecoder();
  const [chunk] = (await once(socket, "data")) as [Buffer];
  const [reply] = decoder.push(chunk) as Array<{ type: string; error: { code: string } }>;
  assert.equal(reply?.type, "error");
  assert.equal(reply.error.code, "installation-incomplete");
  socket.destroy();

  const code = await host.stop();
  // Windows has no SIGTERM: the kill ends the runtime at once, and its watchdog stops VICE.
  if (process.platform !== "win32") assert.equal(code, 0);
});

test("c64-re-tools-host refuses a bad --port", async () => {
  const host = spawn(process.execPath, [...process.execArgv, "src/host/main.ts", "--port", "seven"], { cwd: root, stdio: "ignore" });
  const [code] = (await once(host, "exit")) as [number | null];
  assert.equal(code, 2);
});

test("c64-re-tools-host does not start without VICE and says how to install it", () => {
  const run = spawnSync(process.execPath, [...process.execArgv, "src/host/main.ts", "--port", "0"], { cwd: root, encoding: "utf8", env: { ...process.env, C64RT_VICE: join(scratch, "no-such-x64sc") } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /C64RT_VICE.*Install VICE/);
});

test("c64-re-tools-host does not start when VICE cannot load its ROMs", { skip: shellStandIn }, () => {
  const brokenVice = join(scratch, "x64sc");
  writeFileSync(brokenVice, [
    "#!/bin/sh",
    'while [ $# -gt 0 ]; do [ "$1" = -logfile ] && log="$2"; shift; done',
    "echo \"C64MEM: Error - Couldn't load kernal ROM 'kernal-901227-03.bin'.\" > \"$log\"",
    "exit 255",
  ].join("\n"));
  chmodSync(brokenVice, 0o755);
  const run = spawnSync(process.execPath, [...process.execArgv, "src/host/main.ts", "--port", "0"], { cwd: root, encoding: "utf8", env: { ...process.env, C64RT_VICE: brokenVice } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /does not start:\n  C64MEM: Error - Couldn't load kernal ROM/);
  assert.equal(run.stdout, "", "it never listens");
});
